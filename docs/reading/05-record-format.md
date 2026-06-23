# The record format

## What it is

A **record** is how a row's column values are serialized into bytes — the
"payload" inside a leaf cell or index cell. It is the densest part of the format
and the heart of reading actual data.

A record has two parts, in order:

```
[ record header ] [ record body ]
```

- The **header** describes the *types* (and therefore sizes) of each column, using
  one varint per column called a **serial type**.
- The **body** holds the actual bytes of each value, back to back, in column order.

## The record header

The header itself begins with a varint giving the **total header length in bytes**
(including that length varint itself). After it come the per-column **serial type**
varints:

```
[ header length (varint) ] [ serial type 0 (varint) ] [ serial type 1 ] ...
```

You keep reading serial types until you have consumed `header length` bytes. The
number of serial types tells you the number of columns.

## Serial types

Each serial type is a varint that encodes both the column's type *and* its size.
The mapping:

| Serial type | Body size | Meaning |
|------------:|----------:|---------|
| 0 | 0 | NULL |
| 1 | 1 | 8-bit signed integer |
| 2 | 2 | 16-bit signed integer (big-endian) |
| 3 | 3 | 24-bit signed integer |
| 4 | 4 | 32-bit signed integer |
| 5 | 6 | 48-bit signed integer |
| 6 | 8 | 64-bit signed integer |
| 7 | 8 | IEEE 754 64-bit float (big-endian) |
| 8 | 0 | Integer constant **0** (no bytes in body) |
| 9 | 0 | Integer constant **1** (no bytes in body) |
| 10, 11 | — | Reserved (not used) |
| N >= 12, **even** | (N-12)/2 | BLOB of that many bytes |
| N >= 13, **odd**  | (N-13)/2 | TEXT of that many bytes (encoding per header) |

Key insight: serial types 8 and 9 store the common values 0 and 1 with **zero**
body bytes — the value is implied by the type. NULLs (type 0) also take no body
space. This is a major space optimization.

For BLOB and TEXT, the *size is baked into the serial type number itself*:

- Even `N >= 12` → BLOB of `(N - 12) / 2` bytes.
- Odd  `N >= 13` → TEXT of `(N - 13) / 2` bytes.

## Worked example: decoding a record

Suppose a record payload is these bytes:

```
04 00 03 1B 01  ...string bytes...
```

### Step 1 — header length

```
varint @ 0 : 0x04  -> header is 4 bytes total (this varint + 3 serial types)
```

So the header occupies bytes 0..3. Bytes 0 is the length; bytes 1, 2, 3 are serial
types.

### Step 2 — read serial types until 4 header bytes consumed

```
varint @ 1 : 0x00 = 0   -> column 0 : NULL,  body size 0
varint @ 2 : 0x03 = 3   -> column 1 : 24-bit signed integer, body size 3
varint @ 3 : 0x1B = 27  -> column 2 : odd, >=13 -> TEXT of (27-13)/2 = 7 bytes
```

Header consumed: 4 bytes (matches the header length). Three columns.

### Step 3 — read the body, in column order

Body begins at offset 4 (right after the header):

```
column 0 (NULL)        : 0 bytes  -> value is NULL
column 1 (24-bit int)  : 3 bytes  -> read 3 big-endian bytes as a signed integer
column 2 (TEXT, 7)     : 7 bytes  -> decode 7 bytes as text (UTF-8 by default)
```

That reconstitutes the row: `(NULL, <some integer>, "<7-char string>")`.

## Worked example: the implicit-value serial types

Suppose a column's serial type is `0x09` (= 9):

```
serial type 9 -> integer constant 1, body size 0
```

The value is **1**, and it consumes **no** bytes in the body. You move straight to
the next column. Likewise serial type 8 means the value is **0** with no body
bytes.

## Signed integers

Integer serial types (1–6) are **big-endian, two's complement, signed**. To read
a 24-bit integer you read 3 bytes big-endian, then sign-extend (if the top bit is
set, the value is negative). A common bug is treating them as unsigned.

## The rowid / "integer primary key" quirk

In a table b-tree, the rowid is stored in the cell (not the record). If a table
column is declared `INTEGER PRIMARY KEY`, that column *aliases* the rowid and is
typically stored as **NULL (serial type 0)** in the record — the real value is the
cell's rowid. When reconstructing the row you substitute the rowid for that NULL
column. (This is why a `SELECT` may show an id even though the record body stored
NULL for it.)

## Gotchas

- **Header length includes its own length varint.** Don't read one too many or one
  too few serial types.
- **Serial types 8 and 9 (and 0) consume no body bytes.** Forgetting this throws
  off every subsequent column's offset.
- **TEXT vs BLOB parity:** even ≥12 = BLOB, odd ≥13 = TEXT. Off-by-one here
  silently misclassifies values.
- **Integers are signed and big-endian.** Sign-extend the shorter widths.
- **Text encoding** comes from the database header (offset 56), not the record.
  Default UTF-8, but UTF-16 databases exist.
- **The INTEGER PRIMARY KEY alias** means a stored NULL may need to be replaced by
  the rowid when presenting the row.

## Relevant tasks

- Decode record format / column types and values (read path).
- Read rows by combining cell rowid + decoded record (read path).
- Insert/update rows (write path) — you encode records using this same format.

## References

- Official spec, "Record format" / "Serial type codes":
  https://www.sqlite.org/fileformat2.html#record_format
