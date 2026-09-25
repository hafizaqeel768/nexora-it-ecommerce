// Phase 16: attribute rules that need no database. Run: docker compose exec app npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ATTRIBUTE_TYPES, checkDefault, CODE, RESERVED_CODES } from "@/lib/attributes";

const value = (r: ReturnType<typeof checkDefault>) => ("value" in r ? r.value : `ERR ${r.error}`);

describe("attribute codes", () => {
  it("lowercase letters, numbers, _; starts with a letter; 2–40 chars", () => {
    for (const ok of ["ram", "screen_size", "gpu2", "a1"]) assert.ok(CODE.test(ok), ok);
    for (const bad of ["RAM", "2ram", "_ram", "r", "screen-size", "screen size", "a".repeat(41), "ram;drop"]) assert.ok(!CODE.test(bad), bad);
  });
  it("built-in product fields are reserved", () => {
    for (const c of ["sku", "price", "name", "category", "status"]) assert.ok(RESERVED_CODES.has(c));
  });
});

describe("default values per input type", () => {
  it("normalises valid defaults", () => {
    assert.equal(value(checkDefault("NUMBER", " 15.60 ")), "15.6");
    assert.equal(value(checkDefault("PRICE", "$1,299")), "1299.00");
    assert.equal(value(checkDefault("BOOLEAN", "Yes")), "yes");
    assert.equal(value(checkDefault("DATE", "2026-02-28")), "2026-02-28");
    assert.equal(value(checkDefault("TEXT", "  Intel Core i7 ")), "Intel Core i7");
    assert.equal(value(checkDefault("TEXT", "")), null);
  });
  it("refuses invalid defaults", () => {
    for (const [t, v] of [
      ["NUMBER", "fifteen"],
      ["NUMBER", "1e5"],
      ["PRICE", "-3"],
      ["BOOLEAN", "maybe"],
      ["DATE", "2026-02-30"],
      ["DATE", "28/02/2026"],
      ["TEXT", "x".repeat(256)],
      ["SELECT", "8 GB"],
    ] as const) {
      assert.match(value(checkDefault(t, v)) ?? "", /^ERR/, `${t} ${v}`);
    }
  });
  it("only dropdown and multiple choice have options; only number has a unit", () => {
    assert.deepEqual(Object.entries(ATTRIBUTE_TYPES).filter(([, t]) => t.options).map(([k]) => k), ["SELECT", "MULTISELECT"]);
    assert.deepEqual(Object.entries(ATTRIBUTE_TYPES).filter(([, t]) => t.unit).map(([k]) => k), ["NUMBER"]);
  });
});
