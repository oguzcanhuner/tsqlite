# Durability: transactions, rollback journal, and WAL

> **Status: skeleton.** The deepest topic in the project. Partly file format (the
> journal/WAL files have defined layouts) and partly protocol (the transaction
> logic). Flesh out when you tackle transactions.

## What it is

How SQLite makes a write **atomic and durable**: either a change fully happens or it
doesn't, even if the process crashes or the power fails mid-write. Without this, a
crash during a [page split](../writing/05-page-splitting.md) could leave the database
half-updated and corrupt.

There are two mechanisms, and SQLite supports both:

- **Rollback journal** (the classic default): before modifying a page, copy the
  *original* page into a separate journal file. To commit, delete the journal. To
  roll back (or recover after a crash), copy the original pages back from the
  journal. The database is the source of truth; the journal lets you undo.
- **Write-Ahead Log (WAL)**: the inverse. New page versions are appended to a
  separate WAL file first; the main database is updated later (during a
  "checkpoint"). Readers can keep reading the old database while a writer appends.
  Better concurrency.

## Why it matters

This is what makes a database a *database* rather than a file you hope doesn't get
corrupted. It's also conceptually the richest part: atomicity, crash recovery,
isolation, and concurrency all live here.

## Concepts to cover when fleshing out

- **Atomicity via journaling** — the copy-before-write protocol (rollback) and the
  append-then-checkpoint protocol (WAL).
- **The transaction lifecycle** — begin, modify pages, commit (or rollback), and
  what each does to the journal/WAL and the main file.
- **Crash recovery** — on open, detecting a leftover journal/WAL and replaying or
  undoing it to reach a consistent state.
- **File formats** — the journal file layout and the WAL file + WAL-index layout
  (these *are* specified).
- **Isolation / locking** — how readers and writers coordinate (file locks for
  rollback journal; the WAL's reader/writer model).
- **A toy scope** — a single-writer, rollback-journal-only implementation is a
  reasonable, instructive target; full WAL with concurrency is a stretch goal.

## Gotchas (preview)

- The header's write/read version (offsets 18–19) signals journal vs WAL mode.
- Recovery must run *before* any normal read/write on open.
- Ordering of disk writes (and flushing) is what actually guarantees durability —
  the hardest thing to get genuinely right.

## CLI checkpoint

Simulate an aborted write (e.g. throw partway through a multi-page change), then
reopen the database — with both your clone and `sqlite3` — and confirm it is intact
and reflects the *pre-write* state (the change was rolled back). A committed change,
by contrast, must survive a reopen.

## Relevant tasks

- Transactions / rollback journal (advanced).
- (Stretch) WAL mode.

## References

- "Atomic Commit In SQLite": https://www.sqlite.org/atomiccommit.html
- "Write-Ahead Logging": https://www.sqlite.org/wal.html
- Rollback journal / temp file formats: https://www.sqlite.org/tempfiles.html
- File format of the WAL: https://www.sqlite.org/fileformat2.html#the_write_ahead_log
