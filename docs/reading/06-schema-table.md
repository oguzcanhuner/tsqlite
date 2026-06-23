# The schema table (sqlite_schema / sqlite_master)

## What it is

The database describes itself. The b-tree rooted at **page 1** is a special table
that lists every table, index, view, and trigger in the database — and, crucially,
**which page each one's b-tree starts on**. This is the bootstrap: read page 1,
parse this table, and you can find everything else in the file.

It is historically called `sqlite_master`; the modern name is `sqlite_schema`.
Both refer to the same thing. It is an ordinary table b-tree — you read it with the
exact same machinery as any other table (cells → records). The only special part
is that you *always know where it is* (page 1) without having to look it up
anywhere.

## Its fixed schema

Every row of the schema table has these five columns, in this order:

| Column | Type | Meaning |
|--------|------|---------|
| `type` | TEXT | One of `table`, `index`, `view`, `trigger`. |
| `name` | TEXT | The name of the object (e.g. the table name). |
| `tbl_name` | TEXT | The table this object is associated with. For a table, equals `name`. For an index, the table it indexes. |
| `rootpage` | INTEGER | **Page number where this object's b-tree begins** (0 for objects with no b-tree, e.g. views/triggers). |
| `sql` | TEXT | The original `CREATE` statement text that defined the object. |

The two columns you will use constantly:

- **`rootpage`** — tells you which page to start traversing to read that table's or
  index's data. This is the link from "I know the table name" to "I can read its
  rows."
- **`sql`** — the literal `CREATE TABLE ...` / `CREATE INDEX ...` text. To learn a
  table's **column names** (and types), you parse this string. The file format
  does *not* store column names in a structured way anywhere else — they live only
  inside this SQL text.

## How you use it (the bootstrap sequence)

```
1. Read the database header (page size).            [02-database-header]
2. Read page 1 as a table b-tree.                   [03-pages, 06-traversal]
   (Remember: page 1's b-tree header starts at byte 100.)
3. For each row, decode its record -> the 5 columns above.  [05-record-format]
4. Build an in-memory list of objects:
     name -> { type, rootpage, sql }
5. To query a table:
     - look up its rootpage,
     - parse its `sql` to get column names,
     - traverse the b-tree at rootpage to read rows.
```

This is exactly the flow your Rust project used: `parse_tables` read page 1, and
`execute` looked up a table by name to find its `rootpage` and column names.

## Worked example (theory)

A schema-table row for a table `albums` decodes to five values:

```
type      = "table"
name      = "albums"
tbl_name  = "albums"
rootpage  = 2
sql       = "CREATE TABLE albums (AlbumId INTEGER PRIMARY KEY, Title TEXT, ArtistId INTEGER)"
```

From this you learn:

- To read `albums`, traverse the b-tree starting at **page 2**.
- Its columns are `AlbumId, Title, ArtistId` — obtained by parsing the `sql`
  string (this is a small parsing job; the column names are not stored separately).
- `AlbumId INTEGER PRIMARY KEY` means that column **aliases the rowid** — recall
  from [record format](05-record-format.md) that such a column is typically stored
  as NULL in the record and its real value is the cell's rowid.

A schema-table row for an index on that table might decode to:

```
type      = "index"
name      = "IFK_AlbumArtistId"
tbl_name  = "albums"
rootpage  = 7
sql       = "CREATE INDEX IFK_AlbumArtistId ON albums (ArtistId)"
```

Telling you: an index b-tree starts at **page 7**, it indexes `albums.ArtistId`,
and (from the `sql`) which column(s) it covers — what you need to decide whether a
`WHERE ArtistId = ?` query can use it (see [query planning](../advanced/02-query-planning.md)).

## Gotchas

- **Page 1's header offset.** The schema table's root is page 1, whose b-tree page
  header starts at **byte 100** (after the database header), not byte 0. This is
  the one place you must apply that offset when traversing. Cell-pointer offsets
  are still measured from the start of the page (byte 0).
- **Column names live only in `sql`.** There is no structured column-name list in
  the file format. You must parse the `CREATE` statement text to recover them.
  (This is one motivation for building a real SQL parser — see
  [SQL parsing](../advanced/01-sql-parsing.md).)
- **`rootpage` can be 0.** Views and triggers have no b-tree. Only objects with a
  `rootpage > 0` (tables and indexes) are traversable.
- **Auto-created internal objects.** SQLite may create internal entries (e.g.
  `sqlite_autoindex_*` for some constraints, or `sqlite_sequence` for
  `AUTOINCREMENT`). A reading implementation should tolerate names it didn't
  expect.
- **It is just a normal table.** Don't over-engineer it — once past the page-1
  offset, the same cell/record decoders read it like any other table.

## Relevant tasks

- Read `sqlite_master` to find tables (read path).
- Parse table column names (read path) — from the `sql` column.
- Parse indexes (read path) — find index `rootpage`s and indexed columns here.
- Create tables / indexes (write path) — you must *insert* rows into this table.

## References

- Official spec, "The schema table":
  https://www.sqlite.org/fileformat2.html#the_schema_table
- `sqlite_schema` documentation:
  https://www.sqlite.org/schematab.html
