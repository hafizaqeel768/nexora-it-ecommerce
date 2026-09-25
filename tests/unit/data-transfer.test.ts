// Phase 15: Data Transfer building blocks that need no database. Run: docker compose exec app npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv, toCsv } from "@/lib/csv";
import { FORMATS } from "@/lib/data-transfer/export-engine";
import { MAX_FILE_BYTES, readUpload } from "@/lib/data-transfer/import-engine";
import { normalizeHeader, parseBoolean, parseInteger, parseMoney, parseText } from "@/lib/data-transfer/values";

const file = (content: BlobPart, name = "data.csv", type = "text/csv") => new File([content], name, { type });

describe("value parsers", () => {
  it("money", () => {
    assert.equal(parseMoney("$1,299.50", "Price").value, 1299.5);
    assert.equal(parseMoney("0", "Price").value, 0);
    for (const bad of ["-5", "12.345", "abc", "1e3", "", "=1+1"]) assert.ok(parseMoney(bad, "Price").error, bad);
    assert.ok(parseMoney("100000000", "Price").error);
  });
  it("integers, booleans, text", () => {
    assert.equal(parseInteger("1,000", "Stock").value, 1000);
    assert.ok(parseInteger("1.5", "Stock").error);
    assert.ok(parseInteger("-1", "Stock").error);
    assert.equal(parseBoolean("Yes", "X").value, true);
    assert.equal(parseBoolean("0", "X").value, false);
    assert.ok(parseBoolean("maybe", "X").error);
    assert.ok(parseText("a".repeat(11), "Name", 10).error);
    assert.ok(parseText("bad\u0007bell", "Name", 50).error);
    assert.equal(parseText("  line1\nline2 ", "Description", 50).value, "line1\nline2");
  });
  it("headers match regardless of case, spaces, dashes and underscores", () => {
    assert.equal(normalizeHeader("Compare-at price"), normalizeHeader("compare_at_price"));
    assert.equal(normalizeHeader("URL slug"), normalizeHeader("url_slug"));
  });
});

describe("CSV", () => {
  it("round-trips quotes, commas, newlines and unicode", () => {
    const rows = [["a,b", 'say "hi"', "line1\nline2", "Ünïcødé – ok"]];
    assert.deepEqual(parseCsv(toCsv(rows)), rows);
  });
  it("export guards formula cells, import removes the guard", () => {
    const csv = toCsv([["=HYPERLINK(\"http://evil\")", "+1", "-2", "@SUM(A1)", "normal"]]);
    assert.match(csv, /"'=HYPERLINK/);
    assert.match(csv, /"'\+1"/);
    assert.deepEqual(parseCsv(csv)[0], ['=HYPERLINK("http://evil")', "+1", "-2", "@SUM(A1)", "normal"]);
  });
  it("CSV format writes a BOM and the header", () => {
    assert.ok(FORMATS.csv.begin(["A", "B"]).startsWith('﻿"A","B"'));
  });
});

describe("upload checks", () => {
  it("accepts a UTF-8 CSV and strips any path from the name", async () => {
    const r = await readUpload(file("Name\nX\n", "../../etc/passwd.csv"));
    assert.ok(!("error" in r));
    if (!("error" in r)) assert.equal(r.name, "passwd.csv");
  });
  it("refuses non-CSV names, types, empty, oversized, binary and non-UTF-8 files", async () => {
    assert.ok("error" in (await readUpload(file("x", "data.xlsx"))));
    assert.ok("error" in (await readUpload(file("x", "data.csv", "application/x-msdownload"))));
    assert.ok("error" in (await readUpload(file("", "data.csv"))));
    assert.ok("error" in (await readUpload(null)));
    assert.ok("error" in (await readUpload(file(new Uint8Array(MAX_FILE_BYTES + 1).fill(65)))));
    assert.ok("error" in (await readUpload(file(new Uint8Array([0x4e, 0x00, 0x41])))));
    assert.ok("error" in (await readUpload(file(new Uint8Array([0xff, 0xfe, 0xfd])))));
  });
});
