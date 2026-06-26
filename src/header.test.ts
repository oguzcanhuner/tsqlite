import assert from "node:assert";
import { describe, it } from "node:test";
import { parseHeader } from "./header.js";

describe("parseHeader", () => {
  it("it returns the pageSize of a given database file", async () => {
    const header = await parseHeader("test/fixtures/chinook.db");

    assert.equal(header.pageSize, 1024);
  });
});
