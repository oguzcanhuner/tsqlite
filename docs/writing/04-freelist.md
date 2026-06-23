# The freelist (tracking and reusing free pages)

## What it is

How SQLite tracks pages that were once used but are now free, so they can be reused
for future allocations instead of always growing the file. Relevant once you start
*deleting* data or *splitting* pages (both create or consume pages).

A reader can ignore the freelist entirely — free pages aren't part of any live
b-tree. It becomes important on the write path: when you need a new page, you should
take one from the freelist if available before extending the file.

## Why it exists

When you delete rows or drop tables, whole pages can become unused. Shrinking the
file is expensive and often pointless (it'll grow again), so SQLite keeps free pages
on a list and recycles them. This avoids constant resizing and fragmentation.

## How it's tracked

The database header records the freelist (see
[reading/database-header](../reading/02-database-header.md)):

- Offset 32: page number of the **first freelist trunk page** (0 if empty).
- Offset 36: **total number of freelist pages**.

The freelist is a linked structure of two kinds of page:

- **Trunk pages** — each holds a pointer to the *next* trunk page plus an array of
  page numbers of free **leaf** pages.
- **Leaf pages** — the actual reusable free pages, listed by a trunk.

A trunk page layout:

| Offset | Size | Meaning |
|-------:|-----:|---------|
| 0 | 4 | Page number of the next freelist trunk page (0 if none). |
| 4 | 4 | Number `N` of leaf page pointers that follow. |
| 8 | 4·N | `N` page numbers, each a free leaf page. |

## How it's used (write path)

- **Allocate a page:** if the freelist is non-empty, pull a leaf page from a trunk
  (update the trunk's count, and the header's freelist count) instead of extending
  the file. Only grow the file (and bump the in-header page count at offset 28) when
  the freelist is empty.
- **Free a page:** add it to the freelist — push its number onto a trunk's array
  (or start a new trunk if full) — and update the header's freelist count.

## Worked example (theory)

Header says first trunk = page 5, total freelist pages = 3.

```
page 5 (trunk) = [ next trunk = 0 ] [ count = 2 ] [ page 8 ] [ page 12 ]
```

So pages 8 and 12 are free leaf pages; page 5 is itself a freelist (trunk) page.
That's 3 freelist pages total (trunk + 2 leaves), matching the header. To allocate,
hand out page 12, decrement the trunk count to 1 and the header count to 2.

## Gotchas

- **Keep header counts consistent.** Allocating/freeing must update the header's
  freelist pointer (offset 32) and count (offset 36), or the file is corrupt.
- **Page pointers are 4-byte big-endian**, not varints.
- **Prefer reuse over growth.** Always check the freelist before extending the file;
  otherwise the file grows unboundedly under churn.
- **Bound traversal** of the trunk chain on corrupt files.

## CLI checkpoint

Hard to observe directly, but you can verify indirectly: delete rows/pages, then
insert new ones, and confirm the **file size does not grow** (freed pages were
reused) while `sqlite3` still reads the database correctly.

## Relevant tasks

- Manage free pages / freelist (write path).
- Page splitting (consumes pages — ideally from the freelist).
- Delete rows / drop tables (free pages onto the freelist).

## References

- Official spec, "The freelist":
  https://www.sqlite.org/fileformat2.html#freelist
