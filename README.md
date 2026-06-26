# SQLite Clone in TypeScript

A minimal SQLite implementation, built from scratch in TypeScript to learn how a
real database works under the hood.

> **This is a learning project.** It is not production software and makes no
> attempt to be complete, fast, or safe. The goal is understanding: by
> reimplementing SQLite's on-disk format and a toy query engine by hand, you see
> exactly how bytes on disk become tables, rows, and query results.

## Aims

- **Understand database internals.** Read and write the real sqlite file format -
  the database header, fixed-size pages, b-trees, cells, the record format,
  overflow pages - and build a small query engine on top (parsing, planning,
  execution).
- **Verify against the real thing.** Build a CLI and use it with a real sqlite database dump to verify that it adheres to the spec.

## Using this for your own learning

You're welcome to use this repo to learn the same things:

- The docs directory contains a number of ai-generated documents which distill the sqlite spec (with worked examples). I find this kind of compact format easiest to learn from. Use these to guide your build.
- I will heavily comment code as I go along. If you become stuck, feel free to look at how I handled it.
- Use AI to ask questions and critique your solutions. Avoid the temptation to get it to write the code for you - your learning will be less effective.

The docs are language-agnostic, so they work just as well if you'd rather
implement your own version in another language.

## Why Typescript

It's not an obvious choice for building a database, but it _is_ a language that
many people already know. It's also a high level language, so it should make it
easier to understand.

## Getting started

Clone the project and then

```sh
npm install      # install dependencies
npm run build    # compile TypeScript to dist/
npm test         # build, then run the test suite
```

## Contributing

Any improvements are welcome. For all contributions (code, comment or documentation),
the important thing is that changes should improve the ability to understand. It
doesn't need to be performant, scalable etc.
