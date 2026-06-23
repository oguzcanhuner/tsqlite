# Query planning

> **Status: skeleton.** Flesh out when you reach planning/optimization tasks.
> Execution engine, not file format. No spec — only your (toy) design, informed by
> how SQLite's real planner thinks. Language-agnostic theory.

## What it is

Turning an AST into a **query plan**: a concrete description of *how* to produce
the result — which b-trees to read, in what order, whether to use an index, how to
apply filters. The planner decides; the executor carries it out.

```
AST  ──planner/optimizer──>  query plan  ──executor──>  rows
```

For a toy engine the planner can start almost trivial ("always full-scan the
table, then filter") and grow toward choosing indexes.

## The key decision: full scan vs index scan

- **Full table scan:** traverse the whole table b-tree, emit every row, then apply
  the `WHERE` filter. Simple, always correct, `O(n)`.
- **Index scan:** if there's an index on a column used in the `WHERE`, search the
  index b-tree to get matching rowids, then fetch just those rows from the table
  b-tree. `O(log n + matches)`. (See [b-tree traversal](../reading/07-btree-traversal.md) for
  the index→rowid→row mechanics.)

The planner's job is to recognize when the second is possible and worthwhile.

## What a real optimizer does (and how little yours needs to)

SQLite's planner is large and sophisticated: cost estimation, statistics
(`ANALYZE`), join ordering, many index strategies. A toy planner can ignore nearly
all of it and still be instructive by implementing one or two real ideas:

- **Sargable predicate detection** — recognizing a `WHERE col = value` that an
  index can satisfy (vs `WHERE f(col) = value`, which it can't).
- **Index selection** — picking an available index whose leading column matches a
  filter.
- **Plan representation** — a small tree/struct describing the chosen strategy.

## Concepts to cover when fleshing out

- A minimal plan representation (e.g. `FullScan(table, filter)` vs
  `IndexScan(index, key, then-fetch table)`).
- Matching `WHERE` predicates against available indexes (from the schema table).
- Why ordering/limit can sometimes be served directly by an index's natural order.

## Worked example (theory)

`SELECT * FROM albums WHERE artist_id = 5`

- No index on `artist_id` → plan: `FullScan(albums, filter: artist_id = 5)`.
- Index on `artist_id` exists → plan: `IndexScan(idx_artist, key = 5)` then fetch
  each resulting rowid from the `albums` table b-tree.

Same result, very different cost. The planner chooses; the executor runs it.

## Relevant tasks

- Use indexes for faster lookups (read path).
- `WHERE` clause (the planner consumes the parsed condition).
- Later: `ORDER BY` / `LIMIT` optimizations via index order.

## References

- SQLite "Query Optimizer Overview" (readable, and shows what a *real* one does):
  https://www.sqlite.org/optoverview.html
- SQLite "The Next-Generation Query Planner":
  https://www.sqlite.org/queryplanner-ng.html
- `EXPLAIN QUERY PLAN` (how SQLite reports its chosen plan — great for comparison):
  https://www.sqlite.org/eqp.html
