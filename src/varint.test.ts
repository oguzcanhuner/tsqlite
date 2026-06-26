import assert from "node:assert";
import { describe, it } from "node:test";
import { decodeVarint } from "./varint.js";

describe("given a varint 300", () => {
  it("returns 300", () => {
    const varint = decodeVarint(new Uint8Array([0x82, 0x2c]));

    assert.equal(varint.value, BigInt(300));
  });
});

describe("given a varint 0", () => {
  it("returns 0", () => {
    const varint = decodeVarint(new Uint8Array([0x00]));

    assert.equal(varint.value, BigInt(0));
  });
});

describe("given a varint 16384", () => {
  it("returns 16384", () => {
    const varint = decodeVarint(new Uint8Array([0x81, 0x80, 0x00]));

    assert.equal(varint.value, BigInt(16384));
  });
});
