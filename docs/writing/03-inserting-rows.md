# Inserting rows (appending a cell to a page)

## What it is

Adding a new row to a table by placing its [encoded cell](02-encoding-records-and-cells.md)
onto a leaf page and updating that page's bookkeeping so the page stays valid. This
is the first *mutating* checkpoint: insert a row, then read it back.

This doc covers the case where the new cell **fits** on the target leaf page. When
it doesn't, you must split the page — see [page splitting](05-page-splitting.md).

## The page geometry you must maintain

Recall a b-tree page's layout (see [reading/pages-and-btrees](../reading/03-pages-and-btrees.md)):

```
[ page header ] [ cell pointer array ] [ ... free space ... ] [ cell content ]
                grows downward ->                      <- grows upward
```

- The **cell pointer array** (2 bytes per cell) grows downward from just after the
  header.
- The **cell content area** grows upward from the bottom of the page.
- Free space is the gap between them. The new cell's bytes go at the *bottom* of the
  free space; its pointer goes at the *top*.

## The insertion procedure (cell fits)

1. **Find the target leaf page** for the new rowid by navigating the b-tree as for a
   keyed lookup (see [reading/btree-traversal](../reading/07-btree-traversal.md)).
   Table rows are ordered by rowid, so the cell belongs on the leaf where that rowid
   sorts.
2. **Check it fits.** Required space = `cell_bytes + 2` (the cell plus its new 2-byte
   pointer). Compare against the page's free space. If it doesn't fit → split.
3. **Write the cell bytes** into the cell content area: place them so the content
   area start (page-header offset 5) moves *down* by `cell_bytes`.
4. **Update the content area start** (page-header offset 5) to the new, lower offset.
5. **Insert the cell pointer** into the cell pointer array, keeping the array in
   **rowid order** (so reads stay in order). This means shifting later pointers to
   make room and writing the new 2-byte offset in the correct slot.
6. **Increment the cell count** (page-header offset 3).
7. (If on page 1) remember the header offset quirk — the b-tree header is at byte
   100.

## Keeping cells ordered

A subtle but important point: the **cell content** can be placed anywhere in the
free space (cells need not be physically ordered), but the **cell pointer array**
should be in key order, because traversal walks the pointer array in sequence and
expects ascending rowids. So you sort *pointers*, not bytes.

## Worked example (theory)

A leaf page currently has 2 cells, content area starts at offset 4000 (on a 4096
page), and you insert a row whose encoded cell is 20 bytes and whose rowid sorts
between the two existing cells.

```
before:
  header: cells=2, content_start=4000
  pointer array: [ptr0, ptr1]     (ascending rowid)

steps:
  free space check: need 20 + 2 = 22 bytes; assume it fits.
  write 20 cell bytes at 4000-20 = 3980 .. 3999
  new content_start = 3980
  new pointer = 3980
  insert pointer between ptr0 and ptr1 (rowid order): [ptr0, 3980, ptr1]
  cells = 3

after:
  header: cells=3, content_start=3980
  pointer array: [ptr0, 3980, ptr1]
```

Now a read traverses ptr0, 3980, ptr1 in order and sees all three rows in ascending
rowid.

## Choosing the rowid

If the caller doesn't supply one, the conventional rowid is `max(existing rowid) +
1`. SQLite tracks this; a toy implementation can scan for the current max (or, for
`AUTOINCREMENT`, consult the `sqlite_sequence` table). The rowid goes in the cell,
not the record (see the INTEGER PRIMARY KEY quirk in
[encoding](02-encoding-records-and-cells.md)).

## Free-space reuse (later refinement)

A first implementation can ignore freeblocks and just allocate from the contiguous
free gap. Real SQLite also reuses **freeblocks** (gaps left by deleted cells) and
tracks fragmentation (page-header offsets 1 and 7). You can add this when you
implement [deletion](06-updating-and-deleting.md); until then, contiguous
allocation is fine and correct.

## Gotchas

- **Account for the 2-byte pointer** in the fit check, not just the cell bytes.
- **Pointer array stays in key order**; inserting in the wrong slot breaks ordered
  reads and any binary search.
- **Update *both* the cell count and the content-area start.** Forgetting either
  corrupts the page.
- **Don't overwrite the pointer array** when writing cell content — they grow toward
  each other; the fit check is what guarantees they don't collide.
- **Page 1 header offset** (byte 100) still applies if you insert into the schema
  table's root.

## CLI checkpoint

```
# after inserting a row with your clone:
sqlite3 mydb.db 'SELECT * FROM t'     # the real tool should show your new row
```

Also verify your *own* read path returns the row, and ideally that the row count
increased by exactly one. A round-trip (insert → read back → compare) is the key
test.

## Relevant tasks

- Insert rows / append to leaf pages (write path).

## References

- Official spec, "B-tree pages" (page geometry):
  https://www.sqlite.org/fileformat2.html#b_tree_pages
- Prerequisite: [encoding records and cells](02-encoding-records-and-cells.md).
- Overflow case when a page is full: [page splitting](05-page-splitting.md).
