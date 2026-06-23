# Joins and aggregation

> **Status: skeleton.** Flesh out when you reach joins/aggregates/ordering.
> Execution engine, not file format. Language-agnostic theory and patterns.

## What it is

The higher-level query operations that combine or summarize rows: `JOIN`,
aggregate functions (`COUNT`, `SUM`, ...), `GROUP BY`, and `ORDER BY`. Each is a
processing stage layered on top of scanning + filtering.

## Joins

Combining rows from two (or more) tables based on a condition.

- **Nested-loop join** (the toy default): for each row of table A, scan table B
  and emit pairs that satisfy the join condition. Simple, always works, `O(n·m)`.
- **Index nested-loop join:** if B has an index on the join column, replace the
  inner scan with an index lookup → `O(n · log m)`. This is the natural payoff of
  having built [index traversal](../reading/07-btree-traversal.md).
- (Hash joins and merge joins exist in bigger engines; out of scope for a toy.)

Join *types* (inner, left outer, etc.) change which non-matching rows are kept;
start with inner join.

## Aggregation

Collapsing many rows into summary values.

- **Aggregate functions** maintain an accumulator across rows: `COUNT` increments,
  `SUM` adds, `MIN`/`MAX` track extremes.
- **`GROUP BY`** partitions rows into groups by key, then aggregates within each
  group — conceptually a map from group-key → accumulator(s).
- **`HAVING`** filters *groups* after aggregation (vs `WHERE`, which filters rows
  before).

## Ordering

- **`ORDER BY`** sorts the result by one or more keys. The simple approach:
  collect all rows, then sort. The optimization: if an index already yields rows
  in the required order, you can skip the sort entirely (ties back to
  [planning](02-query-planning.md)).
- **`LIMIT`/`OFFSET`** trims the (possibly ordered) result.

## The pipeline mental model

These stages compose into a pipeline, conceptually:

```
scan ──> filter (WHERE) ──> join ──> group + aggregate ──> having ──> order ──> limit
```

A toy engine can implement them as discrete passes over in-memory rows before
worrying about streaming or pushing work down into scans/indexes.

## Worked example (theory)

`SELECT artist_id, COUNT(*) FROM albums GROUP BY artist_id`

```
scan albums
group rows by artist_id        -> { 1: [..], 2: [..], ... }
for each group, COUNT its rows -> { 1: 5, 2: 3, ... }
emit (artist_id, count) pairs
```

## Concepts to cover when fleshing out

- Nested-loop join, then index-assisted join.
- Accumulator-based aggregates and the group→accumulator map for `GROUP BY`.
- `WHERE` vs `HAVING` ordering in the pipeline.
- Sort-based `ORDER BY` and when an index removes the sort.

## Relevant tasks

- `JOIN` queries (advanced).
- Aggregations `COUNT`/`SUM`/etc. (advanced).
- `ORDER BY` (advanced).

## References

- SQLite "Query Optimizer Overview" (covers joins & ordering decisions):
  https://www.sqlite.org/optoverview.html
- SQLite aggregate function semantics:
  https://www.sqlite.org/lang_aggfunc.html
- SQLite `SELECT` grammar & clause ordering:
  https://www.sqlite.org/lang_select.html
