# Varints (variable-length integers)

## What it is

A varint is SQLite's compact encoding for unsigned 64-bit integers. Small numbers
take few bytes; large numbers take more. They are used everywhere a size or a
rowid appears (record header lengths, payload lengths, rowids, serial types).

The idea: most numbers in a database are small, so spending a fixed 8 bytes on
every integer would waste enormous space. A varint costs 1 byte for values up to
127, and only grows as needed (up to 9 bytes for a full 64-bit value).

## Bits and bytes — how to think about them

Varints are all about manipulating individual bits, so it's worth being completely
fluent in what bits and bytes actually are.

### A bit

A **bit** is the smallest unit of information: a single 0 or 1. That's it. Every
piece of data in a computer is ultimately a pattern of bits.

### A byte

A **byte** is a group of **8 bits** in a row, e.g. `1000 0010`. (The space in the
middle is just for readability — it groups the 8 bits into two nibbles of 4.)

Because each of the 8 positions is independently 0 or 1, a byte has
`2 × 2 × 2 × 2 × 2 × 2 × 2 × 2 = 2^8 = 256` possible patterns. Read as a plain
unsigned number, those patterns represent the integers **0 to 255**:

```
0000 0000 = 0      (all bits off)
0000 0001 = 1
0000 0010 = 2
...
1111 1111 = 255    (all bits on)
```

### How a byte's bits map to a number (place values)

A byte is just a number written in **base 2 (binary)**. In our everyday base 10,
each digit's place is worth a power of ten (1, 10, 100, ...). In binary, each
position is worth a power of **two**, doubling as you move left:

```
position:   7    6    5    4    3    2    1    0     <- "bit number"
value:    128   64   32   16    8    4    2    1     <- what a 1 here is worth
```

To find the number a byte represents, add up the place values wherever there's a 1:

```
1000 0010
│       └─ position 1, value 2  -> on
└───────── position 7, value 128 -> on
= 128 + 2 = 130
```

So the byte `1000 0010` is the number 130. (The bits that are 0 contribute
nothing.)

### Bit numbering: "high" vs "low"

Bits are numbered **0 to 7, from right to left**, by their place value:

- **Bit 0** is the **rightmost** bit, worth 1. It's the **least significant bit**
  (changing it changes the number the least).
- **Bit 7** is the **leftmost** bit, worth 128. It's the **most significant bit**,
  often called the **high bit** (changing it changes the number the most).

Varints reserve the **high bit (bit 7)** as a special flag and use the other seven
bits (bits 0–6) for actual data. Keeping "high = leftmost = worth 128" straight is
most of what makes varints click.

### Hexadecimal: a shorthand for bytes

Writing `1000 0010` everywhere is tedious, so bytes are usually written in
**hexadecimal (base 16)**, prefixed with `0x`. Hex is convenient because **one hex
digit is exactly 4 bits** (a nibble), so **two hex digits = one byte**:

```
binary nibble -> hex digit
0000 = 0      1000 = 8
0001 = 1      1001 = 9
0010 = 2      1010 = a (10)
0011 = 3      1011 = b (11)
0100 = 4      1100 = c (12)
0101 = 5      1101 = d (13)
0110 = 6      1110 = e (14)
0111 = 7      1111 = f (15)
```

So the byte `1000 0010` splits into nibbles `1000` and `0010` = hex `8` and `2` =
**`0x82`**. And indeed `0x82` = `8 × 16 + 2` = 130, matching the place-value sum
above. The three notations are the same byte:

```
binary  1000 0010
hex     0x82
decimal 130
```

### Reading order within a number (endianness, briefly)

Within a single byte, the leftmost bit is the most significant. When a number
spans **several** bytes, there's a second question: does the first byte hold the
most significant part or the least? "Most significant first" is called
**big-endian**. SQLite (and varints) are big-endian: the first byte/group carries
the largest part of the value. (More on this where it matters; just know the term.)

### Why this matters for varints

Everything a varint does is bit-level:

- **"Is the high bit set?"** = is bit 7 (the leftmost, worth 128) a 1? That's the
  continuation flag.
- **"The low 7 data bits"** = bits 0–6, the value once you ignore the high bit.
- **"Shift left by 7 and combine"** = make room for the next 7 data bits and merge
  them in, building the full number group by group.

With bits and bytes clear, the encoding rules below are just precise statements of
those three ideas.

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
