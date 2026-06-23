# CREATE TABLE / CREATE INDEX

> **Status: skeleton.** Flesh out when you reach it. Needs a working SQL parser
> ([advanced/sql-parsing](../advanced/01-sql-parsing.md)) for the `CREATE` statement.

## What it is

Creating a new table or index. Despite the SQL syntax, at the storage level this is
mostly two operations you already have:

1. **Allocate a root page** for the new object's b-tree (an empty table-leaf or
   index-leaf page — see [creating a database](01-creating-a-database.md) for what an
   empty b-tree page looks like).
2. **Insert a row into the schema table** (the b-tree at page 1) describing the new
   object: its `type`, `name`, `tbl_name`, `rootpage`, and the original `sql` text
   (see [reading/schema-table](../reading/06-schema-table.md)).

So "create table" = "allocate a page" + "insert a schema row." You already have both
primitives once inserting works.

## Concepts to cover when fleshing out

- Parsing the `CREATE TABLE` / `CREATE INDEX` statement to get name + columns (reuse
  the [parser](../advanced/01-sql-parsing.md)).
- Allocating the new root page (from the [freelist](04-freelist.md) or by growing the
  file) and writing an empty b-tree page header there.
- Building and inserting the schema-table row, storing the **verbatim** `sql` text
  (the read path recovers column names from it).
- Bumping the **schema cookie** (header offset 40) so other connections notice the
  schema changed.
- For `CREATE INDEX`: after creating the index b-tree, **populate it** by scanning
  the table and inserting an index entry per row.

## Gotchas (preview)

- Store the `sql` text verbatim — column names are recovered from it.
- A new index must be populated from existing rows, not just created empty.
- Update the schema cookie so the change is detected.
- `INTEGER PRIMARY KEY` columns alias the rowid (affects how rows encode).

## CLI checkpoint

```
# after CREATE TABLE with your clone:
sqlite3 mydb.db '.schema'      # should show your new table's CREATE statement
sqlite3 mydb.db '.tables'      # should list it
```

Then insert a row and read it back through both your clone and `sqlite3`.

## Relevant tasks

- Create tables (`CREATE TABLE`) (write path).
- Create indexes (`CREATE INDEX`) (write path).

## References

- Official spec, "The schema table":
  https://www.sqlite.org/fileformat2.html#the_schema_table
- Related: [reading/schema-table](../reading/06-schema-table.md),
  [creating a database](01-creating-a-database.md),
  [parser](../advanced/01-sql-parsing.md).
