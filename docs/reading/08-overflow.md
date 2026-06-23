# Overflow pages

## What it is

What happens when a single record is too big to fit on one page. Since pages are a
fixed size, SQLite stores as much of the record's payload as fits on the page, then
spills the remainder onto a linked chain of **overflow pages**.

You can often ignore overflow when *reading* small, simple databases, but you must
handle it for correctness on real data (long TEXT/BLOB values).

> The **freelist** (reusing freed pages) used to live alongside overflow, but it is
> really a *write-path* concern — see [writing/freelist](../writing/04-freelist.md).
> Overflow matters for reading large records; the freelist matters for allocating
> pages when you write.

## Why overflow exists

A record (the payload of a leaf or index cell) might be larger than what fits on a
page — e.g. a long string or blob. Rather than forbid large values, SQLite keeps
the head of the payload on the page and chains the tail across extra pages.

## How a cell signals overflow

When a payload overflows, the cell ends with a pointer:

```
[ ...the on-page portion of the payload... ] [ 4-byte first-overflow-page number ]
```

The trailing **4-byte big-endian page number** points to the first overflow page.
This pointer is *only present when the payload actually overflows* (see
[cells](04-cells.md) — do not always read 4 trailing bytes).

## The overflow chain

Each overflow page has this layout:

| Offset | Size | Meaning |
|-------:|-----:|---------|
| 0 | 4 | Page number of the **next** overflow page (0 if this is the last). |
| 4 | rest | Payload bytes (continues the record). |

Reconstruct the full payload by: reading the on-page portion, then following the
next-page pointers, concatenating the payload bytes from each page, until the
next-page pointer is 0.

## The spill threshold (when does overflow kick in?)

Whether a payload overflows depends on the page size and the "payload fraction"
constants in the database header (max/min embedded payload fraction, offsets
21–23 — see [database header](02-database-header.md)). The exact formula
determines how many bytes stay on the page vs spill. For a first reading
implementation against small databases you may never hit overflow; for full
correctness you must implement the threshold and the chain-following.

## Worked example (theory)

A table-leaf cell whose payload is 2000 bytes on a 1024-byte-page database:

```
cell = [ payload length=2000 (varint) ]
       [ rowid (varint) ]
       [ first ~1000 payload bytes that fit on this page ]
       [ 4-byte pointer to overflow page, say page 9 ]

page 9  = [ next = page 10 (4 bytes) ] [ ~1020 more payload bytes ]
page 10 = [ next = 0       (4 bytes) ] [ remaining payload bytes  ]
```

Full payload = on-page bytes ++ page 9 bytes ++ page 10 bytes, then handed to the
[record decoder](05-record-format.md) as usual.

## Gotchas

- **Overflow pointer is conditional.** Present only when the payload overflows;
  reading 4 phantom bytes on a non-overflowing cell corrupts your parse.
- **Follow the chain until next-page = 0.** Off-by-one or stopping early truncates
  the record.
- **All these page pointers are 4-byte big-endian**, not varints.
- **Bound your traversal.** On corrupt files, guard against a cyclic overflow chain.

## CLI checkpoint

After this, `SELECT *` on a table containing large values returns the *complete*
values (not truncated). Verify by comparing a long text/blob column against the
real `sqlite3` output for the same row.

## Relevant tasks

- Correctly reconstruct large records that use overflow pages (read path).

## References

- Official spec, "Cell payload overflow pages":
  https://www.sqlite.org/fileformat2.html#ovflpgs
