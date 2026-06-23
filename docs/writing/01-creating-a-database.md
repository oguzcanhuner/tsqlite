# Creating a database from scratch

## What it is

Writing the bytes for a brand-new, empty but **valid** database file — one that the
real `sqlite3` can open without complaint. This is the first write checkpoint, and
a good one: it forces you to get the header exactly right (reading is forgiving;
writing is not).

An empty SQLite database is not zero bytes. At minimum it is **one page** (page 1)
containing the 100-byte database header followed by an **empty table-leaf b-tree
page header** — that empty b-tree *is* the schema table, which simply has no rows
yet.

## What a minimal valid file contains

Page 1, in order:

```
[ 100-byte database header ]
[ b-tree page header for an empty table-leaf page ]
[ ...the rest of the page is free space... ]
```

### The header fields you must set

You don't need every field meaningfully populated, but these must be correct (see
[reading/database-header](../reading/02-database-header.md) for the full table):

| Offset | Size | Value to write |
|-------:|-----:|----------------|
| 0 | 16 | `"SQLite format 3\0"` (exact magic string). |
| 16 | 2 | Page size (e.g. 4096), big-endian. |
| 18 | 1 | Write version (1 = rollback journal — simplest). |
| 19 | 1 | Read version (1). |
| 20 | 1 | Reserved space per page (0). |
| 21 | 1 | 64. |
| 22 | 1 | 32. |
| 23 | 1 | 32. |
| 24 | 4 | File change counter (1 is fine). |
| 28 | 4 | Database size in pages (**1** for a one-page file). |
| 32 | 4 | First freelist trunk page (0 — no freelist). |
| 36 | 4 | Freelist page count (0). |
| 40 | 4 | Schema cookie (0, or 1 if you bump it on schema change). |
| 44 | 4 | Schema format number (4 is current). |
| 48 | 4 | Default page cache size (0). |
| 56 | 4 | Text encoding (1 = UTF-8). |
| 96 | 4 | SQLite version number (any plausible value). |

Everything else can be zero. Bytes 21–23 are *required constants* — SQLite checks
them.

### The empty b-tree page header

Immediately after the 100-byte header (still on page 1) comes an 8-byte
table-leaf page header (see [reading/pages-and-btrees](../reading/03-pages-and-btrees.md)):

| Offset (in page) | Size | Value |
|-----------------:|-----:|-------|
| 100 | 1 | `0x0D` (table leaf). |
| 101 | 2 | First freeblock = 0. |
| 103 | 2 | Number of cells = 0. |
| 105 | 2 | Cell content area start = page_size (or 0 if page_size is 65536). |
| 107 | 1 | Fragmented free bytes = 0. |

With zero cells, there is no cell pointer array and no cell content — the rest of
the page is free space.

## Why the cell content area = page_size

The cell content area grows *downward* from the end of the page. On an empty page,
no content has been written, so the content area "starts" at the very end — i.e. at
`page_size`. As you insert cells, this value decreases. (Recall the special case:
a stored value of 0 means 65536.)

## Worked example (theory)

For a 4096-byte page, page 1 is 4096 bytes total:

```
bytes 0..99    : database header (magic, page_size=0x1000, size_in_pages=1, ...)
byte 100       : 0x0D                 (empty table-leaf = the schema table)
bytes 101..102 : 0x0000              (no freeblock)
bytes 103..104 : 0x0000              (0 cells)
bytes 105..106 : 0x1000 = 4096       (content area starts at end of page)
byte 107       : 0x00                (no fragmentation)
bytes 108..4095: 0x00 ...            (free space)
```

Write those 4096 bytes to a file and the real `sqlite3` should open it as a valid,
empty database.

## Gotchas

- **The file is not empty/zero-length.** It is exactly one full page.
- **Magic string must be byte-exact**, including the trailing NUL.
- **Required constants (21–23).** Wrong values here are rejected.
- **`size in pages` (offset 28) must match reality** (1 for a one-page file), or
  SQLite may distrust the header.
- **Content area start = page_size on an empty page**, not 0 (0 would mean 65536).
- **Page 1's b-tree header is at byte 100**, not byte 0 — the only page where this
  offset applies.

## CLI checkpoint

Write the file, then run the real tool against it:

```
sqlite3 mydb.db '.tables'      # should open cleanly, list nothing
sqlite3 mydb.db '.dbinfo'      # should report page size, 1 page, etc.
```

If `sqlite3` opens it without "file is not a database" / "malformed", you've
produced a valid file.

## Relevant tasks

- Create new database file (write path).
- Write header (write path).

## References

- Official spec, "The database header":
  https://www.sqlite.org/fileformat2.html#the_database_header
- Reading counterpart: [reading/database-header](../reading/02-database-header.md),
  [reading/pages-and-btrees](../reading/03-pages-and-btrees.md).
