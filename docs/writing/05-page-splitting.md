# Page splitting (and growing the tree)

> **Status: skeleton.** Flesh out when you reach it. This is the hardest part of the
> write path — give it its own focused attention.

## What it is

What happens when you try to [insert a cell](03-inserting-rows.md) but it doesn't
fit on the target leaf page. You **split** the page into two, distribute the cells
between them, and insert a **separator key + child pointer** into the parent. If the
parent is also full, it splits too — and so on up to the root. When the root splits,
the tree **grows in height**.

This is the mechanism that keeps a b-tree balanced as it grows, and it's where most
write-path bugs live.

## Why it matters

Splitting is what makes inserts work at scale and keeps reads `O(log n)`. Getting it
right — and keeping every page valid and ordered throughout — is the core challenge
of writing a b-tree.

## Concepts to cover when fleshing out

- **Leaf split:** allocate a new page (from the [freelist](04-freelist.md) or by
  growing the file), move roughly half the cells to it, fix both pages' headers and
  pointer arrays.
- **Choosing the separator key:** the key that tells the parent which child holds
  which range of rowids/values.
- **Updating the parent (interior page):** insert a new cell (child pointer +
  separator key); the old page's right-most-child pointer may need adjusting.
- **Cascading splits:** if the parent is full, split it too, recursively toward the
  root.
- **Root split / tree growth:** splitting the root creates a *new* root, increasing
  tree height by one. The root's page number is referenced by the schema table's
  `rootpage`, so a root split must update that reference (or keep the root page
  number stable by special handling — note how SQLite keeps the root page fixed).
- **Maintaining invariants:** every page stays ordered, valid, and within size; no
  cells lost or duplicated.

## Worked example (to be written)

Walk through inserting into a full leaf: the split, the half-and-half distribution,
the separator pushed to the parent, and (in a second example) a cascade that grows
the tree's height.

## Gotchas (preview)

- The schema table's `rootpage` must remain correct when a root splits.
- The right-most-child pointer lives in the page header, not a cell — handle it
  specially during splits.
- Off-by-one in the cell distribution loses or duplicates rows.

## CLI checkpoint

Insert enough rows to force at least one split (and ideally a root split / height
increase), then verify **all** rows still read back correctly — in both your clone
and the real `sqlite3`. Row count must be exact.

## Relevant tasks

- Page splitting when a page fills up (write path).

## References

- Official spec, "B-tree pages": https://www.sqlite.org/fileformat2.html#b_tree_pages
- General b-tree insertion/splitting theory (any algorithms text / CLRS, "B-Trees").
- Prerequisite: [inserting rows](03-inserting-rows.md); allocation via
  [freelist](04-freelist.md).
