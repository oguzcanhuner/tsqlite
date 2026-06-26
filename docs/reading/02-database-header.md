# The database header

## What it is

The first **100 bytes** of the database file. It describes global properties of
the whole database: the page size, format versions, the size of the database in
pages, the freelist, and various bookkeeping counters.

Because it lives at the very start of the file, it occupies the first 100 bytes of
**page 1**. This is why page 1 is special: its b-tree content begins at byte
offset 100, not 0 (see [pages and b-trees](03-pages-and-btrees.md)).

## Byte layout

All multi-byte values are **big-endian**. The fields you are most likely to need
are marked. Offsets are from the start of the file.

| Offset | Size | Meaning |
|-------:|-----:|---------|
| 0  | 16 | Magic header string: the ASCII `"SQLite format 3"` followed by a NUL byte (`\0`). |
| 16 | 2  | **Page size** in bytes. Power of two, 512..32768. The value `1` means 65536. |
| 18 | 1  | File format write version (1 = legacy/rollback journal, 2 = WAL). |
| 19 | 1  | File format read version (1 or 2). |
| 20 | 1  | Bytes of unused "reserved" space at the end of each page (usually 0). |
| 21 | 1  | Maximum embedded payload fraction (must be 64). |
| 22 | 1  | Minimum embedded payload fraction (must be 32). |
| 23 | 1  | Leaf payload fraction (must be 32). |
| 24 | 4  | File change counter. |
| 28 | 4  | **Size of the database file in pages** ("in-header database size"). |
| 32 | 4  | Page number of the first freelist trunk page (0 if none). |
| 36 | 4  | **Total number of freelist pages**. |
| 40 | 4  | Schema cookie. |
| 44 | 4  | Schema format number (1..4). |
| 48 | 4  | Default page cache size. |
| 52 | 4  | Page number of the largest root b-tree page (auto-vacuum), else 0. |
| 56 | 4  | Text encoding: 1 = UTF-8, 2 = UTF-16le, 3 = UTF-16be. |
| 60 | 4  | User version (set by `PRAGMA user_version`). |
| 64 | 4  | Incremental-vacuum mode flag. |
| 68 | 4  | Application ID (`PRAGMA application_id`). |
| 72 | 20 | Reserved for expansion; must be zero. |
| 92 | 4  | Version-valid-for number. |
| 96 | 4  | `SQLITE_VERSION_NUMBER` of the library that last wrote the file. |

## The page size, and why it matters

A SQLite database file is not read or written as one continuous stream of bytes.
Instead, the whole file is divided into equal-sized chunks called **pages**, and
the **page size** is the length (in bytes) of each one. Every page in a given
database is exactly the same size, fixed at creation time and recorded here in the
header.

The page is the fundamental unit of the format. Almost everything else is built on
top of it:

- **It is the unit of I/O.** SQLite reads and writes whole pages at a time, never
  individual bytes. This maps well onto how operating systems and disks move data
  in fixed-size blocks, which is why the page size is always a power of two
  (512..65536) — typically 4096.
- **It defines where each page lives in the file.** Pages are numbered from 1, and
  page *N* starts at byte offset `(N - 1) * page_size`. So as soon as you know the
  page size, you can jump straight to any page:

  ```
  page 1 -> offset 0
  page 2 -> offset page_size
  page 3 -> offset 2 * page_size
  ...
  ```

- **It bounds how much data fits in one place.** A b-tree node, the cells on it,
  and the records inside them all have to fit within a single page. When they
  don't, the format needs extra machinery (page splitting, overflow pages) — so
  the page size quietly shapes much of the rest of the design.

This is why the page size is the *first* thing you parse: you cannot locate page 2,
walk a b-tree, or read a record until you know how big a page is. It is the key
that unlocks the rest of the file.

> **Reading it is your first verifiable checkpoint.** Decode the page size and
> compare it against `sqlite3 yourdb '.dbinfo'`, which prints the same value.

## Worked example: reading the page size

The page size lives at **offset 16, as a 2-byte big-endian integer** (it is *not* a
varint — header fields are all fixed-width; varints only appear later, in cells and
records).

Suppose bytes 16 and 17 of the file are `0x04 0x00`.

```
page_size = (0x04 << 8) | 0x00   (big-endian: first byte is most significant)
          = 0x0400
          = 1024
```

So the database uses 1024-byte pages.

If bytes 16–17 were `0x00 0x01`, that decodes to 1, which is the **special case
meaning 65536** (because 65536 does not fit in two bytes).

## Worked example: verifying the magic string

The first 16 bytes should be exactly:

```
53 51 4C 69 74 65 20 66 6F 72 6D 61 74 20 33 00
S  Q  L  i  t  e     f  o  r  m  a  t     3  \0
```

If these bytes do not match, the file is not a SQLite database (or is corrupt).
This is a cheap, useful sanity check at startup.

## Gotchas

- **Page size of 1 means 65536**, not 1. Handle this special case explicitly.
- **The header counts as part of page 1.** When you later compute usable space on
  page 1, remember 100 bytes are already consumed by the header.
- **Big-endian only.** Every integer here is most-significant-byte-first.
- **The in-header page count can be stale** in some legacy files; SQLite also
  derives the size from the actual file length. For a learning clone, trusting
  the file length (`file_size / page_size`) is often simpler and safe for reading.
- **Text encoding affects how you decode text values** later (offset 56). Most
  databases are UTF-8; do not assume it blindly if you want full correctness.

## References

- Official spec, "The database header":
  https://www.sqlite.org/fileformat2.html#the_database_header
