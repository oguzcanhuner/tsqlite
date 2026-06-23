# Cells

## What it is

A **cell** is one entry on a b-tree page. Each cell pointer (from the cell pointer
array) points to a cell. What a cell *contains* depends on the page type. There
are four cell formats, one per b-tree page type.

The recurring pieces inside cells are:

- A **payload**: a record (see [record format](05-record-format.md)), used by leaf
  cells and index cells.
- A **rowid**: the integer key of a table b-tree, stored as a varint.
- A **child page number**: a 4-byte big-endian page pointer, used by interior cells.
- Sometimes an **overflow page pointer**, when the payload is too big to fit on
  one page (see [overflow](08-overflow.md)).

## The four cell formats

### Table leaf cell (page flag `0x0D`)

Holds an actual row. Layout, in order:

| Part | Encoding | Meaning |
|------|----------|---------|
| Payload length | varint | Total bytes of the record payload. |
| Rowid | varint | The integer primary key of this row. |
| Payload | record | The column values (see record format). |
| Overflow page | 4 bytes (optional) | First overflow page, only if payload spills. |

### Table interior cell (page flag `0x05`)

Pure navigation — no payload. Layout:

| Part | Encoding | Meaning |
|------|----------|---------|
| Child page number | 4 bytes | Page of the child b-tree node (left of the key). |
| Rowid key | varint | All rowids in that child are `<=` this key. |

### Index leaf cell (page flag `0x0A`)

Holds an index entry. Layout:

| Part | Encoding | Meaning |
|------|----------|---------|
| Payload length | varint | Total bytes of the record payload. |
| Payload | record | The indexed column values, followed by the rowid. |
| Overflow page | 4 bytes (optional) | First overflow page, only if payload spills. |

### Index interior cell (page flag `0x02`)

Navigation plus a key. Layout:

| Part | Encoding | Meaning |
|------|----------|---------|
| Child page number | 4 bytes | Page of the child b-tree node. |
| Payload length | varint | Total bytes of the record payload (the key). |
| Payload | record | The key values that separate children. |
| Overflow page | 4 bytes (optional) | First overflow page, only if payload spills. |

## Worked example: a table leaf cell

Suppose a cell pointer says cell 0 is at offset 16, and the bytes there are:

```
07 01 03 ... (5 more payload bytes) ...
^  ^  ^------- payload (the record, 7 bytes) ------
|  |
|  rowid varint
payload-length varint
```

Decode in order:

```
varint @ offset 16 : 0x07        -> payload length = 7 bytes
varint @ offset 17 : 0x01        -> rowid = 1
record @ offset 18 : next 7 bytes are the record payload
```

You now know: this row has rowid 1, and its column values live in the next 7
bytes, which you hand to the [record decoder](05-record-format.md).

## Worked example: a table interior cell

Bytes at a cell in an interior page:

```
00 00 00 2A 05
^---------^ ^
child=42    rowid key = 5
```

Decode:

```
4 bytes  : 0x0000002A = 42   -> child page number 42
varint   : 0x05              -> rowid key 5 (all rowids in page 42 are <= 5)
```

To traverse, you descend into page 42; later you handle the page header's
right-most child pointer for rowids greater than the last key.

## Overflow: when a payload does not fit

If a record is larger than the page can hold, SQLite stores as much as fits on the
page and spills the rest onto a chain of **overflow pages**. The 4-byte overflow
pointer at the end of the cell points to the first overflow page. The exact
threshold for spilling depends on the page size and the "payload fractions" in the
header. For a first reading implementation against small databases you may not hit
overflow at all, but you must handle it for correctness. See
[overflow](08-overflow.md).

## Gotchas

- **Order of fields differs by cell type.** Table-leaf is `length, rowid, payload`;
  index-leaf is `length, payload` (no separate rowid — the rowid is the *last*
  value inside the record). Interior cells start with the 4-byte child pointer.
- **The rowid in an index lives inside the record**, appended after the indexed
  columns — not as a separate varint like in table-leaf cells.
- **Overflow pointer is conditional.** Only present when the payload exceeds the
  on-page threshold. Do not always read 4 trailing bytes.
- **Child page numbers are 4-byte big-endian**, not varints.
- **Cells are not stored in pointer order or contiguously**; always follow the
  cell pointer to find a cell's bytes.

## Relevant tasks

- Parse interior page cells (read path).
- Parse leaf page cells (read path).
- Insert rows / page splitting (write path) — you build these cell formats.

## References

- Official spec, "B-tree cell formats":
  https://www.sqlite.org/fileformat2.html#b_tree_pages
