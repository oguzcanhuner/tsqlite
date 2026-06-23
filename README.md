# SQLite Clone in TypeScript

A minimal SQLite implementation, built from scratch to learn TypeScript and
database internals.

See [`docs/`](docs/00-index.md) for a language-agnostic reference on the SQLite
file format and the (toy) query engine, organized to mirror this roadmap.

## Strategy

- Build in the order below — each item is a **verifiable CLI checkpoint**, not just
  a feature. Use the real `sqlite3` (and `EXPLAIN QUERY PLAN`) as an oracle: the
  clone must agree with it.
- Study the relevant `docs/` page first, implement, then verify at the CLI.

## Roadmap

### Reading (query an existing database)

- [ ] **CLI scaffold** — accept a db path + a query/command, print output.
- [ ] **Parse database header** → *checkpoint:* print page size; matches `.dbinfo`.
- [ ] **Decode varints** (unit-testable; everything downstream needs it).
- [ ] Parse b-tree page headers (leaf + interior).
- [ ] Parse cells (table/index, leaf/interior).
- [ ] Decode the record format (serial types → column values).
- [ ] **Read the schema table** → *checkpoint:* list tables; matches `.tables`.
- [ ] **Traverse table b-trees** → *checkpoint:* `SELECT * FROM t`; row count and
      sample rows match `sqlite3`. *(The big one.)*
- [ ] Recover column names from the schema `sql` text.
- [ ] Reconstruct large records via overflow pages → *checkpoint:* long values not
      truncated.
- [ ] **`WHERE` filtering** → *checkpoint:* result set matches `sqlite3`.
- [ ] Parse indexes; **use indexes for lookups** → *checkpoint:* same results as a
      full scan, fewer pages read.

### Writing (create and mutate databases)

- [ ] **Create an empty database** (header + empty root page) → *checkpoint:* real
      `sqlite3` opens it cleanly.
- [ ] Encode records and cells (the inverse of reading; round-trip unit test).
- [ ] **Insert a row** (append a cell to a leaf page) → *checkpoint:* read it back;
      `sqlite3` sees it.
- [ ] Freelist: track and reuse freed pages.
- [ ] **Page splitting** (and tree growth) → *checkpoint:* insert enough rows to
      force a split; all rows still read correctly.
- [ ] **Update / delete rows** → *checkpoint:* changes visible; space reused.
- [ ] **`CREATE TABLE` / `CREATE INDEX`** → *checkpoint:* `.schema` shows the table.

### Advanced (the query engine & durability)

- [ ] **Real SQL parser** (tokenizer + AST) — replace whitespace-splitting;
      handles quoted strings, expressions, commas, parens.
- [ ] Expression evaluation (powers `WHERE`, with NULL/three-valued logic).
- [ ] **Query planning** — choose index vs scan → *verify against*
      `EXPLAIN QUERY PLAN`.
- [ ] `JOIN` queries (nested-loop, then index-assisted).
- [ ] Aggregations (`COUNT`, `SUM`, ...) and `GROUP BY` / `HAVING`.
- [ ] `ORDER BY` / `LIMIT`.
- [ ] Multi-column indexes.
- [ ] **Transactions** (rollback journal) → *checkpoint:* an aborted write leaves
      the database unchanged after reopen. *(Stretch: WAL.)*

## Docs map

| Phase | Docs |
|-------|------|
| Reading | [`docs/reading/`](docs/00-index.md) |
| Writing | [`docs/writing/`](docs/00-index.md) |
| Advanced | [`docs/advanced/`](docs/00-index.md) |
