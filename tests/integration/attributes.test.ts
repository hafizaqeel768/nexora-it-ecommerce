// Phase 16: attributes and options against a real (throwaway) database. Run: npm run test:integration
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { AdminAccess } from "@/lib/acl";
import * as attrs from "@/lib/attributes";
import { db } from "@/lib/db";

if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Integration tests only run against a *_test database.");

const superA: AdminAccess = { id: "at-super", isSuperAdmin: true, permissions: [] };
const viewer: AdminAccess = { id: "at-view", isSuperAdmin: false, permissions: ["attributes.view"] };
const editor: AdminAccess = { id: "at-edit", isSuperAdmin: false, permissions: ["attributes.view", "attributes.edit"] };
const base = { required: false, defaultValue: "", unit: "", active: true, sortOrder: "", description: "", showOnProduct: true };
const opt = (label: string, extra: Partial<attrs.OptionRow> = {}): attrs.OptionRow => ({ id: "", label, active: true, isDefault: false, ...extra });
const labels = async (attributeId: string) => (await db.attributeOption.findMany({ where: { attributeId }, orderBy: { sortOrder: "asc" } })).map((o) => `${o.label}${o.active ? "" : "(off)"}${o.isDefault ? "*" : ""}`);

after(() => db.$disconnect());

let ram = "";
let ports = "";

describe("attributes", () => {
  it("creates attributes of every type with normalised defaults", async () => {
    const r = await attrs.saveAttribute(superA, null, { ...base, code: "RAM", name: "RAM", type: "SELECT", required: true });
    assert.ok(r.id, r.error);
    ram = r.id!;
    assert.equal((await db.attribute.findUniqueOrThrow({ where: { id: ram } })).code, "ram", "code lower-cased");
    const s = await attrs.saveAttribute(superA, null, { ...base, code: "screen_size", name: "Screen size", type: "NUMBER", defaultValue: "15.60", unit: "in" });
    const screen = await db.attribute.findUniqueOrThrow({ where: { id: s.id } });
    assert.equal(screen.defaultValue, "15.6");
    assert.equal(screen.unit, "in");
    const w = await attrs.saveAttribute(superA, null, { ...base, code: "warranty_note", name: "Warranty", type: "TEXT", unit: "ignored" });
    assert.equal((await db.attribute.findUniqueOrThrow({ where: { id: w.id } })).unit, null, "unit only for numbers");
    ports = (await attrs.saveAttribute(superA, null, { ...base, code: "ports", name: "Ports", type: "MULTISELECT" })).id!;
    for (const t of ["TEXTAREA", "BOOLEAN", "DATE", "PRICE"]) {
      assert.ok((await attrs.saveAttribute(superA, null, { ...base, code: `t_${t.toLowerCase()}`, name: `T ${t}`, type: t })).id, t);
    }
  });

  it("validates code, name, type, sort order and default", async () => {
    const bad = async (input: Partial<attrs.AttributeInput>) => (await attrs.saveAttribute(superA, null, { ...base, code: "okcode", name: "Ok", type: "TEXT", ...input })).fields ?? {};
    assert.ok((await bad({ code: "2bad" })).code);
    assert.ok((await bad({ code: "sku" })).code, "reserved");
    assert.ok((await bad({ code: "ram" })).code, "duplicate code");
    assert.ok((await bad({ name: "ram" })).name, "duplicate name, any case");
    assert.ok((await bad({ name: "" })).name);
    assert.ok((await bad({ type: "COLOR" })).type);
    assert.ok((await bad({ sortOrder: "1.5" })).sortOrder);
    assert.ok((await bad({ type: "NUMBER", defaultValue: "big" })).defaultValue);
    assert.equal(await db.attribute.count({ where: { code: "okcode" } }), 0);
  });

  it("code and input type can't change after creation", async () => {
    const r = await attrs.saveAttribute(superA, ram, { ...base, code: "changed", name: "Memory (RAM)", type: "TEXT", required: true });
    assert.ok(r.ok, r.error);
    const a = await db.attribute.findUniqueOrThrow({ where: { id: ram } });
    assert.equal(a.code, "ram");
    assert.equal(a.type, "SELECT");
    assert.equal(a.name, "Memory (RAM)");
  });

  it("permissions are checked by the service", async () => {
    assert.match((await attrs.saveAttribute(viewer, null, { ...base, code: "nope", name: "Nope", type: "TEXT" })).error ?? "", /permission/);
    assert.match((await attrs.saveAttribute(viewer, ram, { ...base, name: "X" })).error ?? "", /permission/);
    assert.match((await attrs.saveOptions(viewer, ram, [opt("8 GB")])).error ?? "", /permission/);
    assert.match((await attrs.setAttributeActive(viewer, ram, false)).error ?? "", /permission/);
    assert.match((await attrs.deleteAttribute(editor, ram)).error ?? "", /permission/);
    assert.match((await attrs.saveAttribute(editor, null, { ...base, code: "nope", name: "Nope", type: "TEXT" })).error ?? "", /attributes\.create/);
  });

  it("the database refuses an invalid code even without the app", async () => {
    await assert.rejects(db.attribute.create({ data: { code: "Bad Code", name: "Bad", type: "TEXT" } }));
  });
});

describe("options", () => {
  it("adds options in order with one default for a dropdown", async () => {
    const r = await attrs.saveOptions(editor, ram, [opt(" 8  GB "), opt("16 GB", { isDefault: true }), opt("32 GB"), opt("64 GB")]);
    assert.ok(r.ok, r.error);
    assert.deepEqual(await labels(ram), ["8 GB", "16 GB*", "32 GB", "64 GB"]);
  });

  it("renames, reorders (even swapping labels), disables and keeps ids", async () => {
    const [o8, o16, o32, o64] = await db.attributeOption.findMany({ where: { attributeId: ram }, orderBy: { sortOrder: "asc" } });
    const r = await attrs.saveOptions(editor, ram, [
      { id: o64.id, label: "8 GB", active: true, isDefault: false },
      { id: o8.id, label: "64 GB", active: false, isDefault: false },
      { id: o16.id, label: "16 GB", active: true, isDefault: true },
      { id: o32.id, label: "32 GB", active: true, isDefault: false },
    ]);
    assert.ok(r.ok, r.error);
    assert.deepEqual(await labels(ram), ["8 GB", "64 GB(off)", "16 GB*", "32 GB"]);
    assert.equal(await db.attributeOption.count({ where: { attributeId: ram } }), 4, "same rows, no recreate");
  });

  it("refuses duplicates, empty labels, two defaults on a dropdown, a disabled default and foreign ids", async () => {
    const before = await labels(ram);
    assert.ok((await attrs.saveOptions(editor, ram, [opt("A"), opt("a")])).error);
    assert.ok((await attrs.saveOptions(editor, ram, [{ ...opt(""), id: (await db.attributeOption.findFirstOrThrow({ where: { attributeId: ram } })).id }])).error);
    assert.ok((await attrs.saveOptions(editor, ram, [opt("A", { isDefault: true }), opt("B", { isDefault: true })])).error);
    assert.ok((await attrs.saveOptions(editor, ram, [opt("A", { isDefault: true, active: false })])).error);
    const other = (await attrs.saveOptions(editor, ports, [opt("USB-C")])) && (await db.attributeOption.findFirstOrThrow({ where: { attributeId: ports } }));
    assert.match((await attrs.saveOptions(editor, ram, [{ id: other.id, label: "Stolen", active: true, isDefault: false }])).error ?? "", /reload/);
    assert.ok((await attrs.saveOptions(editor, ram, Array.from({ length: attrs.MAX_OPTIONS + 1 }, (_, i) => opt(`O${i}`)))).error);
    assert.deepEqual(await labels(ram), before, "nothing changed");
    assert.equal((await db.attributeOption.findUniqueOrThrow({ where: { id: other.id } })).label, "USB-C");
  });

  it("multiple choice may have several defaults; non-option types have no options", async () => {
    assert.ok((await attrs.saveOptions(editor, ports, [opt("USB-C", { isDefault: true }), opt("HDMI", { isDefault: true }), opt("Ethernet")])).ok);
    assert.deepEqual(await labels(ports), ["USB-C*", "HDMI*", "Ethernet"]);
    const screen = await db.attribute.findUniqueOrThrow({ where: { code: "screen_size" } });
    assert.ok((await attrs.saveOptions(editor, screen.id, [opt("15 in")])).error);
  });

  it("removing an option deletes it (nothing uses it yet)", async () => {
    const keep = await db.attributeOption.findMany({ where: { attributeId: ram, label: { in: ["8 GB", "16 GB"] } }, orderBy: { sortOrder: "asc" } });
    assert.ok((await attrs.saveOptions(editor, ram, keep.map((o) => ({ id: o.id, label: o.label, active: o.active, isDefault: o.isDefault })))).ok);
    assert.deepEqual(await labels(ram), ["8 GB", "16 GB*"]);
  });
});

describe("disable and delete", () => {
  it("disables and enables", async () => {
    assert.ok((await attrs.setAttributeActive(editor, ram, false)).ok);
    assert.equal((await db.attribute.findUniqueOrThrow({ where: { id: ram } })).active, false);
    assert.ok((await attrs.setAttributeActive(editor, ram, true)).ok);
  });
  it("deletes an unused attribute with its options", async () => {
    assert.ok((await attrs.deleteAttribute(superA, ram)).ok);
    assert.equal(await db.attribute.count({ where: { id: ram } }), 0);
    assert.equal(await db.attributeOption.count({ where: { attributeId: ram } }), 0);
    assert.ok((await attrs.deleteAttribute(superA, ram)).error, "already gone");
  });
});
