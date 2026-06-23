# B-tree traversal

## What it is

How you walk a b-tree to read its contents. Two operations matter:

1. **Full scan** — visit every row of a table (e.g. `SELECT * FROM t`).
2. **Keyed lookup** — find a specific row by rowid, or find index entries by value
   (the basis of using indexes).

Both start from a **root page** (you get root page numbers from the
[schema table](06-schema-table.md)) and descend toward leaves.

## The shape of a b-tree

- **Leaf pages** hold data cells (rows for tables, index entries for indexes).
- **Interior pages** hold pointers to child pages plus separator keys.
- An interior page with `n` cells has `n + 1` children: one child per cell (to the
  "left" of that cell's key) plus the **right-most child** stored in the page
  header (for keys greater than the last cell's key).

```
                 [ interior page ]
       cell0(key=5)   cell1(key=12)   right-most-child
          |               |                 |
       child A         child B           child C
   (rowids <= 5)   (5 < rowids <= 12)  (rowids > 12)
```

## Full scan (read all rows)

A full scan is an in-order traversal that visits every leaf:

```
traverse(page):
    if page is a leaf:
        for each cell on the page:
            yield the cell's data (rowid + decoded record)
    else (interior):
        for each cell on the page (in order):
            traverse(cell.child_page)        # descend into each left child
        traverse(page.right_most_child)      # finally the right-most child
```

The crucial detail: on an interior page you must descend into **every** per-cell
child **and** the header's right-most child. Visiting only the per-cell children
silently drops the last subtree (the largest keys) — a classic bug.

For a plain `SELECT *` you don't even need to inspect the separator keys; you just
visit all children left to right. The keys only matter for *lookups*.

## Worked example: visiting children of an interior page

An interior page has 2 cells and a right-most child:

```
cell 0 : child = page 10, key = 5
cell 1 : child = page 11, key = 12
header : right-most child = page 12
```

A full scan descends in this order: page 10, then page 11, then page 12. Each of
those may itself be interior (recurse) or a leaf (emit rows). The result is all
rows in ascending rowid order.

## Keyed lookup by rowid (table b-tree)

To find a single rowid `R`, you don't scan — you navigate:

```
search(page, R):
    if page is a leaf:
        scan cells for the one whose rowid == R
    else (interior):
        for each cell (in ascending key order):
            if R <= cell.key:
                return search(cell.child_page, R)   # go left/into this child
        return search(page.right_most_child, R)     # R is greater than all keys
```

Because the tree is ordered and balanced, this touches only one page per level —
`O(log n)` instead of `O(n)`. This is why a rowid lookup is fast.

## Keyed lookup in an index b-tree

Index b-trees work the same way, except:

- Keys are **column values** (the indexed columns), not rowids, so comparisons use
  the column collation/ordering rather than integer order.
- The index leaf's record contains the indexed values **followed by the rowid**.
  So once you find matching index entries, you extract the rowid from the end of
  each entry, then go look that rowid up in the *table* b-tree to get the full row.

This two-step dance — search the index to get rowids, then fetch rows from the
table — is exactly what "using an index for faster lookups" means.

## Gotchas

- **Always include the right-most child.** The single most common traversal bug.
- **Interior pages have `n + 1` children for `n` cells.** Don't expect a child per
  key only.
- **Don't confuse table order with index order.** Table b-trees are ordered by
  rowid; index b-trees by the indexed values.
- **The rowid is appended inside index records.** To bridge from an index hit to
  the actual row, read the trailing rowid and look it up in the table b-tree.
- **Guard against cycles / runaway recursion** on corrupt files; bound your
  traversal by the page count if you want robustness.
- **Page 1 as a root.** The schema table's root is page 1, whose header starts at
  byte 100 — handle that offset when traversing from the root of the schema.

## Relevant tasks

- Traverse table b-trees to read rows (read path).
- Parse indexes / use indexes for faster lookups (read path, later).
- `WHERE` filtering can be layered on top of a full scan first, then optimized to
  use index lookups.

## References

- Official spec, "B-tree pages" (structure & navigation):
  https://www.sqlite.org/fileformat2.html#b_tree_pages
