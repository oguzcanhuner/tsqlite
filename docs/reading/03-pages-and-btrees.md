# Pages and b-trees

## What it is

The database file is an array of fixed-size **pages**. Most pages are **b-tree
pages**, the building blocks of tables and indexes. This file explains the page
numbering, the four kinds of b-tree page, and the b-tree page header.

## Pages

- Every page has the same size (the `page_size` from the header).
- Pages are numbered starting at **1**.
- The byte offset of a page in the file is: `(page_number - 1) * page_size`.
- **Page 1** contains the 100-byte database header at its start, so its b-tree
  content begins at byte 100 *within the page*. All other pages start their
  b-tree content at byte 0.

There are several page types overall (b-tree pages, freelist pages, overflow
pages, pointer-map pages), but the two you care about first are **b-tree pages**.

## The four kinds of b-tree page

A b-tree page is described by a single **flag byte** (the first byte of the page
header). The two dimensions are *table vs index* and *interior vs leaf*:

| Flag byte | Page type | Holds |
|----------:|-----------|-------|
| `0x0D` (13) | Table leaf | Actual table rows (rowid + record). |
| `0x05` (5)  | Table interior | Pointers to child pages + the rowid keys that separate them. |
| `0x0A` (10) | Index leaf | Index records (the indexed values + rowid). |
| `0x02` (2)  | Index interior | Pointers to child pages + the key values that separate them. |

Mnemonics: **leaf = data**, **interior = navigation**. **Table = keyed by
rowid**, **index = keyed by column values**.

## The b-tree page header

Immediately at the start of the page (or after the 100-byte file header, on
page 1) sits the page header. It is **8 bytes for leaf pages** and **12 bytes for
interior pages** (interior pages have an extra 4-byte pointer at the end).

| Offset | Size | Meaning |
|-------:|-----:|---------|
| 0 | 1 | Page type flag (one of the four values above). |
| 1 | 2 | Start of the first freeblock on the page (0 if none). |
| 3 | 2 | **Number of cells** on this page. |
| 5 | 2 | Start of the **cell content area** (offset from page start; 0 means 65536). |
| 7 | 1 | Number of fragmented free bytes in the cell content area. |
| 8 | 4 | **Right-most child pointer** — *interior pages only*. Absent on leaf pages. |

After the header comes the **cell pointer array**: one **2-byte** entry per cell,
each a big-endian offset (from the start of the page) to where that cell's data
begins. There are `number_of_cells` entries.

So the layout of a page is, in order:

```
[ page header ] [ cell pointer array ] [ ... free space ... ] [ cell content ]
                                                              ^ grows downward
```

Cell *pointers* grow downward from the top; cell *content* grows upward from the
bottom. The free space is in the middle. This is how a page fills up.

## Worked example: reading a leaf page header

Suppose a page (not page 1) begins with these bytes:

```
0D 00 00 00 03 03 BA 00  10 02 02 ... 
^  ^---^ ^---^ ^---^ ^
flag freeblk #cells content frag
```

Decode field by field (all big-endian):

```
byte 0      : 0x0D            -> table leaf page
bytes 1..2  : 0x0000          -> no freeblocks
bytes 3..4  : 0x0003          -> 3 cells on this page
bytes 5..6  : 0x03BA = 954    -> cell content begins at offset 954
byte 7      : 0x00            -> 0 fragmented free bytes
```

Because the flag is `0x0D` (leaf), there is **no** right-most child pointer, so
the header is 8 bytes. The cell pointer array begins at offset 8.

With 3 cells, the cell pointer array is `3 × 2 = 6` bytes (offsets 8..13). In the
example, the next bytes `00 10 02 02 ...` are the first two 2-byte cell pointers:

```
cell pointer 0 : 0x0010 = 16    -> cell 0's content is at offset 16
cell pointer 1 : 0x0202 = 514   -> cell 1's content is at offset 514
```

(You would read a third pointer, then follow each pointer into the cell content
area to parse the cells themselves — see [cells](04-cells.md).)

## Worked example: an interior page header

If the flag byte were `0x05` (table interior), the header would be **12 bytes**
and bytes 8..11 would be the right-most child pointer, e.g.:

```
byte 0      : 0x05            -> table interior page
bytes 8..11 : 0x00 00 00 2A   -> right-most child is page 42
```

The cell pointer array would then begin at offset 12, not 8.

## Gotchas

- **Page 1's header offset.** On page 1 only, the b-tree page header starts at
  byte 100 (after the file header), and the cell pointer offsets are still
  measured from the start of the page (byte 0), not from byte 100. Be careful
  mixing the two reference points.
- **Leaf vs interior header size.** 8 vs 12 bytes. Forgetting the extra 4 bytes on
  interior pages (the right-most child pointer) shifts your cell pointer array and
  corrupts everything after it.
- **Cell content offset 0 means 65536.** Same trick as page size.
- **Cell pointers are offsets, not indices.** Each is a byte offset from the page
  start to the cell's data; they are not necessarily in ascending order, and the
  cells are not necessarily contiguous.
- **The right-most child is in the header, not a cell.** When traversing an
  interior page you must visit all the per-cell child pointers *and* this one
  extra right-most pointer (see [traversal](07-btree-traversal.md)).

## Relevant tasks

- Parse b-tree page headers (read path).
- Parse interior/leaf page cells (read path).
- Page splitting when a page fills up (write path) — driven by the cell content
  area / free space geometry above.

## References

- Official spec, "The b-tree page":
  https://www.sqlite.org/fileformat2.html#b_tree_pages
