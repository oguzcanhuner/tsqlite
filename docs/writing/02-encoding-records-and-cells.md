# Encoding records and cells

## What it is

The inverse of reading: turning in-memory values into the exact bytes of a
**record**, then wrapping that record in a **cell**. If you've implemented the read
path, you already understand the target format — encoding is decoding run backwards,
but with no tolerance for error (the bytes must be exactly valid).

This doc assumes the read-side docs as background:
[varints](../reading/01-varints.md), [record format](../reading/05-record-format.md),
[cells](../reading/04-cells.md).

## Encoding a varint

To encode an unsigned integer as a varint (the inverse of
[reading/varints](../reading/01-varints.md)):

- Split the value into **7-bit groups**, most-significant group first.
- Set the high (continuation) bit on every group **except the last**.
- Special case: a full 64-bit value uses 9 bytes, where the 9th byte carries 8
  data bits (no continuation bit).

Worked example — encode 300:

```
300 = 00000010 0101100   (14 bits)
group 1 (high 7 bits): 0000010 = 2  -> not last -> set high bit -> 0x82
group 2 (low  7 bits): 0101100 = 44 -> last      -> high bit 0  -> 0x2C
result: 0x82 0x2C
```

## Encoding a record

A record is `[ header ] [ body ]` (see [record format](../reading/05-record-format.md)).
To build it, you must decide each value's **serial type**, because the serial type
determines both how the value is written *and* how many header/body bytes it uses.

Procedure:

1. **Choose a serial type per column** from the value:
   - NULL → serial type 0 (no body bytes).
   - Integer 0 → serial type 8; integer 1 → serial type 9 (no body bytes!).
   - Other integers → the smallest signed width that holds it (types 1–6).
   - Float → serial type 7 (8 bytes, IEEE 754 big-endian).
   - Text of length L → serial type `13 + 2*L` (odd).
   - Blob of length L → serial type `12 + 2*L` (even).
2. **Encode each serial type as a varint.** Concatenate them — these are the
   header body.
3. **Compute the header length** = (length of the header-length varint itself) +
   (bytes of all serial-type varints). This is circular because the length varint's
   own size can change the total; in practice you compute the serial-type bytes
   first, then find the smallest header-length varint that is self-consistent.
4. **Write** `header-length varint` ++ `serial-type varints` ++ `value bytes`.
5. **Encode the body**: each value's bytes in column order. Integers are
   big-endian, signed, written in the width implied by their serial type. Types 0,
   8, 9 contribute *no* body bytes.

Worked example — encode the row `(NULL, 7, "abcdefg")`:

```
serial types:
  NULL        -> 0
  7 (fits i8) -> 1   (8-bit signed integer, 1 body byte)
  "abcdefg"   -> 13 + 2*7 = 27  (text, 7 body bytes)

serial-type varints: 0x00 0x01 0x1B           (3 bytes)
header length      : 1 (the length varint) + 3 = 4 -> 0x04
header             : 04 00 01 1B
body               : (no bytes for NULL) 07 (the integer) "abcdefg"
record             : 04 00 01 1B 07 61 62 63 64 65 66 67
```

Note this is exactly the bytes you'd *decode* in
[reading/record-format](../reading/05-record-format.md), confirmed in reverse.

## Encoding a cell

Wrap the record in the cell format for the page type (see
[cells](../reading/04-cells.md)). For a **table-leaf** cell:

```
[ payload length (varint) ] [ rowid (varint) ] [ record bytes ]  [ (overflow ptr if needed) ]
```

So: encode the record, take its byte length as the payload length varint, encode
the rowid varint, and concatenate. If the payload is too large for the page, you
must split it across overflow pages (see [reading/overflow](../reading/08-overflow.md)
for the chain format) — but a first implementation can assume records fit.

## The INTEGER PRIMARY KEY quirk (write side)

If a column is `INTEGER PRIMARY KEY`, it aliases the rowid. When encoding the
record you typically store **NULL** for that column and put its real value in the
**cell's rowid** instead. (Mirror of the read-side substitution.)

## Gotchas

- **Header length includes its own varint.** Get the self-referential count right
  or every offset shifts.
- **Use the no-body serial types.** Integers 0 and 1 (types 8/9) and NULL (type 0)
  must contribute zero body bytes — don't write a byte for them.
- **Pick the smallest integer width** that holds the value (types 1–6) to match how
  SQLite encodes; correctness doesn't strictly require minimal width, but it should
  round-trip.
- **Integers are signed, big-endian, two's complement.** Negative values need
  correct sign bits in the chosen width.
- **Text encoding** must match the header's encoding field (UTF-8 by default).

## CLI checkpoint

This step has no standalone CLI output, but it is the prerequisite for the next:
once you can encode a cell, [inserting a row](03-inserting-rows.md) becomes a
read-back-and-compare checkpoint. A good unit test here is a **round trip**: encode
a row, then decode it with your read path, and assert you get the original values.

## Relevant tasks

- Insert rows (write path) — depends on this.
- Update rows (write path) — re-encodes records.

## References

- Official spec, "Record format":
  https://www.sqlite.org/fileformat2.html#record_format
- Reading counterparts: [record format](../reading/05-record-format.md),
  [cells](../reading/04-cells.md), [varints](../reading/01-varints.md).
