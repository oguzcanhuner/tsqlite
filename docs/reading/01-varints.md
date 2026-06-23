# Varints (variable-length integers)

## What it is

A varint is SQLite's compact encoding for unsigned 64-bit integers. Small numbers
take few bytes; large numbers take more. They are used everywhere a size or a
rowid appears (record header lengths, payload lengths, rowids, serial types).

The idea: most numbers in a database are small, so spending a fixed 8 bytes on
every integer would waste enormous space. A varint costs 1 byte for values up to
127, and only grows as needed (up to 9 bytes for a full 64-bit value).

## The encoding rules

- A varint is **1 to 9 bytes** long, **big-endian** (most significant group first).
- For the **first 8 bytes**, the **high bit (bit 7) is a continuation flag**:
  - High bit = 1 → "more bytes follow."
  - High bit = 0 → "this is the last byte."
  - The remaining **low 7 bits** of each such byte are data.
- The **9th byte is special**: if you reach a 9th byte, **all 8 of its bits are
  data** (no continuation flag). This lets 9 bytes hold a full 64-bit value
  (8 × 7 = 56 bits from the first eight bytes, plus 8 from the ninth = 64).

To decode: read bytes left to right, accumulating 7 data bits at a time (shift
the running value left by 7, OR in the new 7 bits), stopping when you hit a byte
whose high bit is 0 — or when you have consumed 9 bytes.

## Why the high bit works as a flag

Each byte is 8 bits. By reserving the top bit to mean "continue?", you have a
self-describing length: the value tells you where it ends. The reader never needs
to know the length in advance — it discovers it while decoding. The cost is that
each byte only carries 7 bits of payload (for the first 8 bytes).

## Worked example: decoding 300

The value 300 is encoded as the two bytes `0x82 0x2C`.

```
Byte 1: 0x82 = 1000 0010
        ^ high bit = 1  -> more bytes follow
        data bits (low 7) = 000 0010 = 2

Byte 2: 0x2C = 0010 1100
        ^ high bit = 0  -> last byte
        data bits (low 7) = 010 1100 = 44
```

Now combine, most significant group first:

```
value = 0
value = (value << 7) | 2   ->  0000010                     = 2
value = (value << 7) | 44  ->  0000010 0101100             = 300
```

Check the arithmetic on the final 14 bits:

```
00000100101100  =  256 + 32 + 8 + 4  =  300
```

Bytes read: 2. The caller advances its cursor by 2 to read whatever comes next.

## Worked example: a single-byte varint

The value 44 fits in 7 bits, so it is one byte with the high bit clear:

```
0x2C = 0010 1100
       ^ high bit = 0 -> last (and only) byte
       data = 010 1100 = 44
```

Bytes read: 1.

## Worked example: 16384

16384 = 0x4000 needs 15 bits, so it spans three bytes: `0x81 0x80 0x00`.

```
Byte 1: 0x81 = 1000 0001  high=1, data = 0000001 = 1
Byte 2: 0x80 = 1000 0000  high=1, data = 0000000 = 0
Byte 3: 0x00 = 0000 0000  high=0, data = 0000000 = 0  (last byte)

value = 0
value = (0      << 7) | 1 = 1
value = (1      << 7) | 0 = 128
value = (128    << 7) | 0 = 16384
```

## Gotchas

- **Read order matters.** Varints are big-endian groups: the first byte holds the
  *most* significant 7 bits, not the least. A common bug is assembling them
  backwards.
- **The 9-byte case is the exception, not the rule.** Only on the 9th byte do you
  use all 8 bits. If you write a loop that always masks off the high bit, you'll
  silently drop the top bit of any true 64-bit value. Cap the loop at 9 bytes and
  treat the 9th specially.
- **Values can exceed 53-bit safe integers.** A varint is a full unsigned 64-bit
  number. Any implementation language that only has 53-bit-safe integers must use
  a wider integer type for correctness (rowids and serial types are usually
  small, but the encoding permits the full range).
- **Never read past 9 bytes.** A malformed varint must not run away; the maximum
  length is hard-capped at 9.

## Relevant tasks

- Decode varints (read path).
- Everything downstream — cells, record headers, rowids — depends on this.

## References

- Official spec, "Variable-length integers":
  https://www.sqlite.org/fileformat2.html#varint
