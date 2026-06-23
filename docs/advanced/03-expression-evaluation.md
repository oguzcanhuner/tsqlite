# Expression evaluation

> **Status: skeleton.** Flesh out when you implement `WHERE` and expressions.
> Execution engine, not file format. Language-agnostic theory and patterns.

## What it is

Computing the value of an expression (from the parsed AST) against a particular
row. This is what makes `WHERE id = 1` actually filter, and what computes derived
columns like `price * quantity`.

```
expression AST  +  a row (column values)  ──evaluator──>  a value
```

For `WHERE`, the resulting value is interpreted as truthy/falsy to decide whether
the row passes.

## The core pattern: tree-walking evaluation

An expression is a tree (built by the [parser](01-sql-parsing.md)). You evaluate
it recursively — the classic **tree-walking interpreter** / visitor pattern:

```
eval(node, row):
    Literal(v)            -> v
    Column(name)          -> row[name]
    BinaryOp(op, l, r)    -> apply(op, eval(l, row), eval(r, row))
    UnaryOp(op, x)        -> apply(op, eval(x, row))
```

Each node type has a rule; compound nodes recurse into children first. This same
pattern scales to arithmetic, comparisons, boolean logic, and function calls.

## What makes SQL evaluation fiddly

- **Three-valued logic.** SQL comparisons can yield TRUE, FALSE, or **NULL**
  (unknown). `NULL = NULL` is NULL, not true. `WHERE` keeps rows only where the
  predicate is TRUE (not NULL, not FALSE). This trips up everyone.
- **Type affinity / coercion.** SQLite compares values with specific rules across
  integers, reals, text, blobs, and NULL. A toy engine can start with strict
  same-type comparison and add coercion later.
- **Operator semantics.** `AND`/`OR` with NULL operands follow the three-valued
  truth tables, not ordinary boolean logic.

## Concepts to cover when fleshing out

- The evaluator function and how it consumes a decoded row (from the
  [record format](../reading/05-record-format.md)).
- Three-valued logic truth tables for `AND`, `OR`, `NOT`, comparisons.
- How `WHERE` uses the result (TRUE passes; NULL/FALSE reject).
- Where evaluation sits relative to scanning: filter each scanned row, or push the
  predicate into an index lookup (see [planning](02-query-planning.md)).

## Worked example (theory)

`WHERE id = 1` against a row where `id = 1`:

```
BinaryOp(=, Column(id), Literal(1))
  eval(Column(id))  -> 1
  eval(Literal(1))  -> 1
  apply(=, 1, 1)    -> TRUE   -> row passes
```

Against a row where `id = 2` → `apply(=, 2, 1)` → FALSE → row rejected.
Against a row where `id` is NULL → `apply(=, NULL, 1)` → NULL → row rejected
(NULL is not TRUE).

## Relevant tasks

- `WHERE` clause filtering (read path).
- Expression evaluation (advanced).
- Foundation for `ORDER BY` keys and aggregate inputs.

## References

- SQLite "NULL handling" (three-valued logic):
  https://www.sqlite.org/nulls.html
- SQLite "Datatypes / type affinity & comparison rules":
  https://www.sqlite.org/datatype3.html
- Crafting Interpreters, "Evaluating Expressions" (the tree-walking pattern):
  https://craftinginterpreters.com/evaluating-expressions.html
