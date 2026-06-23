# Updating and deleting rows

> **Status: skeleton.** Flesh out when you reach it.

## What it is

Modifying existing rows (`UPDATE`) and removing them (`DELETE`). Both find the
target cell(s) via b-tree navigation, then change the page — and must keep the page
and tree valid afterwards.

## Updating

- **Find the cell** by rowid (or via a `WHERE` scan/index).
- **Re-encode the record** with the new values (see
  [encoding](02-encoding-records-and-cells.md)).
- **If the new cell is the same size or smaller:** overwrite in place (and record
  any freed bytes as a freeblock / fragmentation).
- **If it's larger and no longer fits:** treat it like a delete + insert, which may
  trigger a [page split](05-page-splitting.md).

## Deleting

- **Find the cell**, remove its entry from the cell pointer array, decrement the
  cell count.
- **Reclaim the space:** turn the vacated region into a **freeblock** (page-header
  offset 1 chains freeblocks) or fold it into the content area; update fragmentation
  bytes (offset 7).
- **If a page becomes empty:** it can be freed onto the [freelist](04-freelist.md).
  (Real SQLite also *merges/rebalances* under-full pages; a toy version can skip
  rebalancing and just tolerate sparse pages.)

## Concepts to cover when fleshing out

- Freeblocks and fragmentation accounting (the read side glossed over these).
- In-place vs relocate decisions for `UPDATE`.
- When to free a page; whether to rebalance (and why a toy clone may not).
- Keeping any affected **indexes** in sync (a row change must update index b-trees
  too).

## Gotchas (preview)

- Indexes must be updated alongside the table, or queries via index go stale.
- Freeblock chains and fragmentation must be maintained or space leaks/corrupts.
- Deleting must preserve pointer-array ordering.

## CLI checkpoint

Update and delete rows with your clone, then confirm with `sqlite3` that the changes
are visible and correct, the row count matches, and (over many delete+insert cycles)
the file reuses space rather than growing without bound.

## Relevant tasks

- Update rows (write path).
- Delete rows (write path).
- Manage free pages / freelist (write path).

## References

- Official spec, "B-tree pages" (freeblocks, fragmentation):
  https://www.sqlite.org/fileformat2.html#b_tree_pages
- Related: [freelist](04-freelist.md), [page splitting](05-page-splitting.md).
