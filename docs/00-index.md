# SQLite Clone — Practical Reference

A distilled, language-agnostic reference for building a minimal SQLite clone from
scratch. The docs are organized to mirror the project roadmap and, above all, to
support **incremental verification**: at each stage there is something you can
check at the CLI, long before the whole thing is finished.

## Two kinds of content

1. **The file format (storage)** — how bytes are laid out on disk. A *fixed
   standard* (the file must be readable by any SQLite version), so there is a right
   answer. These docs distil the official spec, with worked byte-level examples.
2. **The execution engine** — SQL parsing, query planning, expression evaluation.
   *Not* part of the file format and with no spec to conform to: implementation
   choices. The docs cover the theory and the classic design patterns,
   language-agnostically, leaving the concrete (toy-level) design to you.

These docs are **not** a copy of the official spec — they are the practical subset
you actually need. For exhaustive detail, follow the references in each file.

## Layout

Folders mirror the roadmap phases so each maps to a point where you can verify
something:

```
docs/
  reading/    read an existing database (foundation + the read path)
  writing/    create and mutate databases
  advanced/   the query engine + durability (parsing, planning, transactions)
```

### reading/  — read an existing database

| File | Topic |
|------|-------|
| [01-varints](reading/01-varints.md) | The variable-length integer encoding (used everywhere). |
| [02-database-header](reading/02-database-header.md) | The first 100 bytes of the file. |
| [03-pages-and-btrees](reading/03-pages-and-btrees.md) | The fixed-size page; the four b-tree page types. |
| [04-cells](reading/04-cells.md) | How a record is framed on a page. |
| [05-record-format](reading/05-record-format.md) | How column values are serialized. |
| [06-schema-table](reading/06-schema-table.md) | How the database describes its own tables/indexes. |
| [07-btree-traversal](reading/07-btree-traversal.md) | Walking the tree to read rows; keyed lookups. |
| [08-overflow](reading/08-overflow.md) | Reading records too big for one page. |

### writing/  — create and mutate databases

| File | Topic |
|------|-------|
| [01-creating-a-database](writing/01-creating-a-database.md) | Writing a valid header + empty root page from scratch. |
| [02-encoding-records-and-cells](writing/02-encoding-records-and-cells.md) | Encoding (the inverse of reading). |
| [03-inserting-rows](writing/03-inserting-rows.md) | Adding a cell to a page; free-space bookkeeping. |
| [04-freelist](writing/04-freelist.md) | Tracking and reusing free pages. |
| [05-page-splitting](writing/05-page-splitting.md) | Splitting full pages; growing the tree (the hard part). |
| [06-updating-and-deleting](writing/06-updating-and-deleting.md) | Modifying and removing rows; freeing pages. |
| [07-create-table](writing/07-create-table.md) | `CREATE TABLE`/`CREATE INDEX` (writing the schema table). |

### advanced/  — the query engine & durability

| File | Topic |
|------|-------|
| [01-sql-parsing](advanced/01-sql-parsing.md) | Text → tokens → AST. |
| [02-query-planning](advanced/02-query-planning.md) | AST → a plan (scan vs index). |
| [03-expression-evaluation](advanced/03-expression-evaluation.md) | Evaluating `WHERE` and expressions. |
| [04-joins-and-aggregation](advanced/04-joins-and-aggregation.md) | Joins, `GROUP BY`, `ORDER BY`. |
| [05-durability](advanced/05-durability.md) | Transactions, rollback journal, WAL (the deepest topic). |

## How the layers fit together

```
SQL text
   │  parser            -> turns text into an AST (syntax)        [advanced]
   ▼
   AST
   │  planner/optimizer -> turns AST into a query plan           [advanced]
   ▼
   query plan
   │  execution engine  -> runs the plan, evaluates expressions  [advanced]
   ▼
   storage layer        -> bytes on disk: pages, cells, records  [reading/writing]
```

## CLI checkpoints (verify as you go)

The whole point of this ordering: you never have to build the engine before you can
test something. Suggested milestones and how to verify each at the command line.

**Reading**
1. **Page size** — print the page size from the header.
   *Verify:* matches `sqlite3 db '.dbinfo'` / known value.
2. **List tables** — read the schema table, print table names + rootpages.
   *Verify:* matches `sqlite3 db '.tables'`.
3. **`SELECT * FROM t`** — traverse a table b-tree, print rows.
   *Verify:* row count and sample rows match `sqlite3 db 'SELECT * FROM t'`.
   *(This is the big one — the same milestone the Rust project hit.)*
4. **Large values** — rows with overflow read back complete (not truncated).
5. **`WHERE` filter** — filter rows. *Verify:* same result set as `sqlite3`.
6. **Index lookup** — same results as a full scan, fewer pages read.

**Writing**
7. **Create empty DB** — write header + empty root page.
   *Verify:* the real `sqlite3` opens your file with no error.
8. **Insert a row** — append a cell. *Verify:* read it back; `sqlite3` sees it too.
9. **Force a split** — insert enough rows to overflow a page.
   *Verify:* all rows still read correctly in both your clone and `sqlite3`.
10. **Update / delete** — *Verify:* changes visible, freed pages reused.
11. **`CREATE TABLE`** — *Verify:* `sqlite3 db '.schema'` shows your new table.

**Advanced**
12. **Real SQL parser** — handles quoted strings, expressions, commas, parens.
13. **Query plan** — chooses index vs scan. *Verify against* `EXPLAIN QUERY PLAN`.
14. **Joins / aggregates / ordering** — results match `sqlite3`.
15. **Transactions** — a failed/aborted write leaves the DB unchanged.

> Using the real `sqlite3` (and `EXPLAIN QUERY PLAN`) as an oracle is the core
> verification strategy: your clone must agree with it.

## Conventions in the format

- **All multi-byte integers are big-endian** (most significant byte first).
- **Variable-length integers ("varints")** are used for sizes and rowids — see
  [varints](reading/01-varints.md).
- **Offsets within a page** are measured from the *start of the page*, except on
  page 1, whose b-tree content starts after the 100-byte header.

## The mental model (big picture)

1. **A database is a single file**, divided into fixed-size **pages** (a power of
   two, 512..65536). Page size is in the header.
2. **Pages are numbered from 1.** Page 1 begins with the 100-byte header.
   `offset = (page_number - 1) * page_size`.
3. **Everything is a b-tree.** Tables are keyed by rowid; indexes by column values.
4. **A b-tree has interior pages (navigation) and leaf pages (data).** You
   traverse from a root page down to leaves.
5. **The database describes itself.** The b-tree at page 1 is the schema table; it
   lists every table/index and which page each one's b-tree starts on.

## References

- Official file format spec: https://www.sqlite.org/fileformat2.html
- Architecture overview: https://www.sqlite.org/arch.html
- `EXPLAIN QUERY PLAN`: https://www.sqlite.org/eqp.html
- *The Definitive Guide to SQLite* (Owens / Allen) for deeper background.
