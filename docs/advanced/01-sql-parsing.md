# SQL parsing

> **Status: skeleton.** Flesh this out when you reach the SQL-parsing tasks. This
> is the *execution engine*, not the file format — there is no spec to conform to,
> only the SQL language semantics and your own (toy) design. Theory and patterns
> here are language-agnostic.

## What it is

Turning SQL *text* into a structured form a program can act on. Two stages:

```
SQL text  ──tokenizer/lexer──>  tokens  ──parser──>  AST (abstract syntax tree)
```

- **Tokenizer (lexer):** splits the raw string into meaningful atoms — keywords
  (`SELECT`), identifiers (`albums`), literals (`42`, `'rock'`), operators (`=`,
  `<`), punctuation (`,`, `(`, `)`).
- **Parser:** consumes tokens and builds a tree that reflects the *grammar* and
  *precedence* of SQL.

## Why this beats whitespace-splitting

The Rust project's query layer split on whitespace and looked for `SELECT`/`FROM`.
That works for `SELECT * FROM t` and breaks on almost anything else: quoted
strings with spaces, expressions like `price>10`, commas without spaces,
parentheses, nested conditions. A real tokenizer + parser handles these uniformly
and gives you a tree you can evaluate and optimize.

## Concepts to cover when fleshing out

- **Grammar** — a small SQL subset expressed as production rules (start with
  `SELECT cols FROM table [WHERE expr]`).
- **Recursive-descent parsing** — one function per grammar rule; the classic,
  readable way to hand-write a parser.
- **Operator precedence** — how `a OR b AND c` groups; precedence climbing /
  Pratt parsing for expressions.
- **The AST shape** — node types for statements, expressions, literals,
  column references. (This is where a typed/tagged-union representation shines —
  but that's an implementation-time concern.)
- **Error handling** — reporting *where* and *why* parsing failed.

## Worked example: tokenizing (theory)

```
SELECT title FROM albums WHERE id = 1
```

tokenizes to:

```
KEYWORD(SELECT) IDENT(title) KEYWORD(FROM) IDENT(albums)
KEYWORD(WHERE) IDENT(id) OP(=) NUMBER(1)
```

and parses to a tree roughly like:

```
Select
├─ columns: [ Column(title) ]
├─ from:    Table(albums)
└─ where:   BinaryOp(=, Column(id), Literal(1))
```

The body of this file should expand each stage with worked examples.

## Relevant tasks

- Parse basic SQL (replace the whitespace-splitter with a real tokenizer/parser).
- `WHERE` clause (produces an expression subtree → see expression evaluation).
- `CREATE TABLE` / `CREATE INDEX` parsing (write path).

## References

- SQLite's actual SQL grammar (railroad diagrams):
  https://www.sqlite.org/lang.html
- Crafting Interpreters, "Scanning" & "Parsing Expressions" (the canonical
  beginner-friendly treatment of lexing + recursive descent + Pratt parsing):
  https://craftinginterpreters.com/scanning.html
- Pratt / precedence-climbing parsing overview:
  https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
