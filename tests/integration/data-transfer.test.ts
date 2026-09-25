// Phase 15: import/export framework against a real (throwaway) database.
// Run: docker compose exec app npm run test:integration
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parseCsv, toCsv } from "@/lib/csv";
import { categoryImport } from "@/lib/data-transfer/entities/categories";
import { customerImport } from "@/lib/data-transfer/entities/customers";
import { productExport, productImport } from "@/lib/data-transfer/entities/products";
import { exportResponse, FORMATS } from "@/lib/data-transfer/export-engine";
import { errorReportCsv, rowError, runImport, validateCsv } from "@/lib/data-transfer/import-engine";
import { cancelJob, commitJob, createJob, getJob, jobErrorReport, type Actor } from "@/lib/data-transfer/jobs";
import { EXPORTERS, sampleRows } from "@/lib/data-transfer/registry";
import type { ImportAdapter } from "@/lib/data-transfer/types";
import { db } from "@/lib/db";

if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Integration tests only run against a *_test database.");

const csv = (rows: string[][]) => toCsv(rows);
const superActor: Actor = { id: "dt-super", email: "dt-super@example.test", isSuperAdmin: true, permissions: [] };
const catalogOnly: Actor = { id: "dt-cat", email: "dt-cat@example.test", isSuperAdmin: false, permissions: ["import.access", "products.import"] };
const noAccess: Actor = { id: "dt-no", email: "dt-no@example.test", isSuperAdmin: false, permissions: ["products.import"] };
const file = (text: string, name = "test.csv") => ({ text, name, size: text.length });

let top: string;
before(async () => {
  top = (await db.category.create({ data: { slug: "dt-networking", name: "DT Networking" } })).id;
  await db.category.create({ data: { slug: "dt-switches", name: "DT Switches", parentId: top } });
  await db.product.create({ data: { slug: "dt-existing", sku: "DT-EXIST", name: "Existing", brand: "Acme", categoryId: top, price: 10, stock: 5 } });
});
after(() => db.$disconnect());

describe("products import: validation and preview", () => {
  it("reports valid, warning and error rows (Row 2 valid, Row 3 price required, Row 4 category not found…)", async () => {
    const text = csv([
      ["SKU", "Name", "Brand", "Category", "Price", "Stock", "Status", "Mystery column"],
      ["DT-NEW-1", "New switch", "Acme", "DT Switches", "99.50", "10", "active", "x"],
      ["DT-NEW-2", "No price", "Acme", "dt-switches", "", "", "draft", ""],
      ["DT-EXIST", "Existing", "Acme", "Nowhere", "12", "", "", ""],
      ["DT-NEW-3", "Bad values", "Acme", "dt-switches", "abc", "-1", "maybe", ""],
      ["DT-NEW-1", "Duplicate", "Acme", "dt-switches", "5", "", "", ""],
      ["DT-NEW-4", "Unknown cat", "Acme", "Nope", "5", "", "", ""],
    ]);
    const v = await validateCsv(productImport as ImportAdapter, text, "add_update");
    assert.deepEqual(v.fileErrors, []);
    assert.match(v.fileWarnings.join(), /Mystery column/);
    const by = new Map(v.reports.map((r) => [r.line, r]));
    assert.equal(by.get(2)!.level, "valid");
    assert.equal(by.get(2)!.action, "create");
    assert.equal(by.get(3)!.level, "error");
    assert.match(by.get(3)!.messages.join(), /Price is required/);
    assert.equal(by.get(4)!.level, "warning");
    assert.match(by.get(4)!.messages.join(), /Category “Nowhere” not found; the current category is kept/);
    assert.equal(by.get(5)!.level, "error");
    assert.equal(by.get(5)!.messages.length, 3, "price, stock and status errors");
    assert.match(by.get(6)!.messages.join(), /Duplicate/);
    assert.match(by.get(7)!.messages.join(), /not found \(create it/);
    assert.deepEqual({ rows: v.totals.rows, valid: v.totals.valid, warnings: v.totals.warnings, errors: v.totals.errors }, { rows: 6, valid: 1, warnings: 1, errors: 4 });
    assert.equal(await db.product.count({ where: { sku: { startsWith: "DT-NEW" } } }), 0, "validation writes nothing");
  });

  it("rejects files with missing required columns, duplicate columns, ragged rows or no data", async () => {
    const a = productImport as ImportAdapter;
    assert.match((await validateCsv(a, csv([["SKU", "Name"], ["X", "Y"]]), "add")).fileErrors.join(), /needs these columns/);
    assert.match((await validateCsv(a, csv([["Name", "Brand", "Category", "Price"], ["X", "B", "c", "1"]]), "update")).fileErrors.join(), /SKU|URL slug/);
    assert.match((await validateCsv(a, csv([["SKU", "sku"], ["X", "Y"]]), "update")).fileErrors.join(), /appears twice/);
    assert.match((await validateCsv(a, csv([["SKU", "Name", "Brand", "Category", "Price"]]), "add")).fileErrors.join(), /no data rows/);
    const ragged = await validateCsv(a, "SKU,Name,Brand,Category,Price\nDT-R,R,B,dt-switches,1,EXTRA\n", "add");
    assert.match(ragged.reports[0].messages.join(), /cells but the header/);
  });

  it("behaviors: Add skips existing, Update skips unknown", async () => {
    const text = csv([
      ["SKU", "Name", "Brand", "Category", "Price"],
      ["DT-EXIST", "Existing renamed", "Acme", "dt-networking", "10"],
      ["DT-ONLYNEW", "Only new", "Acme", "dt-networking", "10"],
    ]);
    const add = await validateCsv(productImport as ImportAdapter, text, "add");
    assert.equal(add.reports[0].action, "skip");
    assert.match(add.reports[0].messages.join(), /Already exists/);
    assert.equal(add.reports[1].action, "create");
    const upd = await validateCsv(productImport as ImportAdapter, text, "update");
    assert.equal(upd.reports[0].action, "update");
    assert.equal(upd.reports[1].action, "skip");
  });
});

describe("products import: commit", () => {
  it("skip mode imports valid rows only; results and DB agree", async () => {
    const text = csv([
      ["SKU", "Name", "Brand", "Category", "Price", "Compare-at price", "Stock", "Status"],
      ["DT-C1", "Created one", "Acme", "dt-switches", "50", "60", "3", "draft"],
      ["DT-EXIST", "", "", "", "11.25", "", "0", ""],
      ["DT-C2", "Bad", "Acme", "dt-switches", "50", "40", "", ""],
    ]);
    const { result, stopped } = await runImport(productImport as ImportAdapter, text, "add_update", "skip");
    assert.equal(stopped, null);
    assert.deepEqual(result, { created: 1, updated: 1, skipped: 0, failed: 1 });
    const c1 = await db.product.findUniqueOrThrow({ where: { sku: "DT-C1" } });
    assert.equal(c1.status, "DRAFT");
    assert.equal(Number(c1.compareAtPrice), 60);
    const ex = await db.product.findUniqueOrThrow({ where: { sku: "DT-EXIST" } });
    assert.equal(Number(ex.price), 11.25);
    assert.equal(ex.name, "Existing", "empty Name keeps the current value");
    assert.equal(ex.stock, 0);
    assert.equal(ex.availability, "OUT_OF_STOCK");
    assert.equal(await db.product.count({ where: { sku: "DT-C2" } }), 0);
  });

  it("stop mode imports nothing when any row has an error", async () => {
    const text = csv([
      ["SKU", "Name", "Brand", "Category", "Price"],
      ["DT-S1", "Fine", "Acme", "dt-switches", "5"],
      ["DT-S2", "Broken", "Acme", "dt-switches", "x"],
    ]);
    const { result, stopped } = await runImport(productImport as ImportAdapter, text, "add", "stop");
    assert.ok(stopped);
    assert.equal(result.created, 0);
    assert.equal(await db.product.count({ where: { sku: { in: ["DT-S1", "DT-S2"] } } }), 0);
  });

  it("a row that fails while writing doesn't take the rest of its chunk with it, and is never half-written", async () => {
    // Test adapter: writes a category per row, the row named "boom" throws after writing (rolled back).
    const flaky: ImportAdapter<null, { slug: string }> = {
      ...(categoryImport as unknown as ImportAdapter<null, { slug: string }>),
      columns: [{ key: "slug", header: "Slug", required: "key", type: "text", description: "", example: "" }],
      load: async () => null,
      plan: (row) => ({ line: row.line, key: row.get("slug")!, action: "create", errors: [], warnings: [], changes: [], write: { slug: row.get("slug")! } }),
      sortForWrite: undefined,
      write: async (tx, w) => {
        await tx.category.create({ data: { slug: w.slug, name: w.slug } });
        if (w.slug === "dt-boom") throw rowError("Boom on purpose.");
      },
    };
    const text = csv([["Slug"], ["dt-ok-1"], ["dt-boom"], ["dt-ok-2"]]);
    const { result, validation } = await runImport(flaky as unknown as ImportAdapter, text, "add", "skip");
    assert.deepEqual(result, { created: 2, updated: 0, skipped: 0, failed: 1 });
    assert.equal(await db.category.count({ where: { slug: { in: ["dt-ok-1", "dt-ok-2"] } } }), 2);
    assert.equal(await db.category.count({ where: { slug: "dt-boom" } }), 0, "rolled back");
    assert.match(validation.reports[1].messages[0], /Boom on purpose/);
    const report = parseCsv(errorReportCsv(text, validation.reports));
    assert.deepEqual(report[0], ["Row", "Slug", "Errors"]);
    assert.deepEqual(report.slice(1).map((r) => r.slice(0, 2)), [["3", "dt-boom"]]);
    await db.category.deleteMany({ where: { slug: { in: ["dt-ok-1", "dt-ok-2"] } } });
  });

  it("export → import round trip changes nothing", async () => {
    const { filters } = await productExport.parseFilters(new URLSearchParams({ sku: "DT-" }));
    const body = await exportResponse(productExport, filters, FORMATS.csv, "p").text();
    const v = await validateCsv(productImport as ImportAdapter, body, "add_update");
    assert.deepEqual(v.fileErrors, []);
    assert.ok(v.totals.rows >= 2);
    assert.equal(v.totals.create + v.totals.update + v.totals.errors, 0, JSON.stringify(v.reports.filter((r) => r.action !== "skip")));
  });
});

describe("categories import", () => {
  it("creates a parent and its child from the same file (parents written first), refuses a third level", async () => {
    const text = csv([
      ["URL name", "Name", "Parent", "Show in menu", "Sort order"],
      ["dt-child", "DT Child", "dt-parent", "no", "2"],
      ["dt-parent", "DT Parent", "", "yes", "1"],
      ["dt-grandchild", "Too deep", "dt-switches", "", ""],
      ["dt-self", "Self", "dt-self", "", ""],
    ]);
    const v = await validateCsv(categoryImport as ImportAdapter, text, "add");
    // dt-parent comes after its child in the file, so the child can't find it yet
    assert.match(v.reports[0].messages.join(), /not found/);
    const fixed = csv([
      ["URL name", "Name", "Parent", "Show in menu", "Sort order"],
      ["dt-parent", "DT Parent", "", "yes", "1"],
      ["dt-child", "DT Child", "dt-parent", "no", "2"],
      ["dt-grandchild", "Too deep", "dt-switches", "", ""],
      ["dt-self", "Self", "dt-self", "", ""],
    ]);
    const { result, validation } = await runImport(categoryImport as ImportAdapter, fixed, "add", "skip");
    assert.deepEqual(result, { created: 2, updated: 0, skipped: 0, failed: 2 });
    assert.match(validation.reports[2].messages.join(), /subcategory; only two levels/);
    assert.match(validation.reports[3].messages.join(), /not found|own parent/);
    const child = await db.category.findUniqueOrThrow({ where: { slug: "dt-child" }, include: { parent: true } });
    assert.equal(child.parent?.slug, "dt-parent");
    assert.equal(child.showInMenu, false);
  });

  it("a category with subcategories can't become a subcategory", async () => {
    const v = await validateCsv(categoryImport as ImportAdapter, csv([["URL name", "Parent"], ["dt-networking", "dt-parent"]]), "update");
    assert.match(v.reports[0].messages.join(), /has subcategories/);
  });
});

describe("customers import", () => {
  before(async () => {
    const now = new Date();
    await db.customer.create({ data: { email: "dt-staff@example.test", name: "Staff", role: "ADMIN", passwordHash: "x", registeredAt: now } });
    await db.customer.create({ data: { email: "dt-registered@example.test", name: "Reg", passwordHash: "x", registeredAt: now } });
  });

  it("creates guests without a login, updates details, never touches staff or passwords", async () => {
    const text = csv([
      ["Email", "Name", "Phone", "Country", "Tax-exempt", "Password"],
      ["DT-New@Example.test", "New Person", "+1 555", "us", "yes", "hunter2"],
      ["dt-registered@example.test", "Reg Renamed", "", "Germany", "yes", ""],
      ["dt-staff@example.test", "Hacked", "", "", "", ""],
      ["not-an-email", "X", "", "", "", ""],
      ["dt-bad-country@example.test", "Y", "", "Atlantis", "", ""],
    ]);
    const { result, validation } = await runImport(customerImport as ImportAdapter, text, "add_update", "skip");
    assert.match(validation.fileWarnings.join(), /Password/, "unknown column ignored");
    assert.deepEqual(result, { created: 1, updated: 1, skipped: 0, failed: 3 });
    const created = await db.customer.findUniqueOrThrow({ where: { email: "dt-new@example.test" } });
    assert.equal(created.passwordHash, null);
    assert.equal(created.role, "CUSTOMER");
    assert.equal(created.country, "United States");
    assert.equal(created.taxExempt, false, "guests can't be exempt");
    const reg = await db.customer.findUniqueOrThrow({ where: { email: "dt-registered@example.test" } });
    assert.equal(reg.name, "Reg Renamed");
    assert.equal(reg.taxExempt, true);
    assert.equal(reg.passwordHash, "x", "password untouched");
    assert.equal((await db.customer.findUniqueOrThrow({ where: { email: "dt-staff@example.test" } })).name, "Staff");
    assert.match(validation.reports[2].messages.join(), /staff account/);
  });
});

describe("jobs: permissions, preview → confirm once, error report", () => {
  const text = csv([
    ["SKU", "Name", "Brand", "Category", "Price"],
    ["DT-J1", "Job one", "Acme", "dt-switches", "7"],
    ["DT-J2", "Job two", "Acme", "dt-switches", "oops"],
  ]);

  it("needs import.access and the entity permission", async () => {
    assert.ok("error" in (await createJob(noAccess, { entity: "products", behavior: "add", onError: "skip", file: file(text) })));
    assert.ok("error" in (await createJob(catalogOnly, { entity: "customers", behavior: "add", onError: "skip", file: file(text) })));
    assert.ok("error" in (await createJob(superActor, { entity: "orders", behavior: "add", onError: "skip", file: file(text) })), "orders can't be imported");
    assert.ok("error" in (await createJob(superActor, { entity: "products", behavior: "replace", onError: "skip", file: file(text) })));
  });

  it("stores the preview, imports once, blocks a second confirm, offers the error report", async () => {
    const job = await createJob(catalogOnly, { entity: "products", behavior: "add", onError: "skip", file: file(text, "dt-job.csv") });
    assert.ok("id" in job);
    assert.equal(await db.product.count({ where: { sku: "DT-J1" } }), 0, "preview writes nothing");
    const stored = await getJob(catalogOnly, job.id);
    assert.equal(stored?.totals.errors, 1);
    assert.equal(await getJob({ ...catalogOnly, permissions: ["import.access"] }, job.id), null, "others can't read it");

    const [a, b] = await Promise.all([commitJob(catalogOnly, job.id), commitJob(catalogOnly, job.id)]);
    assert.equal([a, b].filter((r) => "ok" in r).length, 1, "only one confirm runs");
    assert.equal(await db.product.count({ where: { sku: "DT-J1" } }), 1);
    const done = await getJob(catalogOnly, job.id);
    assert.equal(done?.status, "DONE");
    assert.deepEqual(done?.result, { created: 1, updated: 0, skipped: 0, failed: 1 });
    const report = await jobErrorReport(catalogOnly, job.id);
    assert.match(report!.csv, /DT-J2/);
    assert.doesNotMatch(report!.csv, /DT-J1/);
    const log = await db.adminAuditLog.findFirstOrThrow({ where: { action: "data.imported", targetId: job.id } });
    assert.equal(log.actorEmail, catalogOnly.email);
  });

  it("a cancelled preview can't be imported", async () => {
    const job = await createJob(superActor, { entity: "products", behavior: "add", onError: "skip", file: file(text.replace(/DT-J/g, "DT-K")) });
    assert.ok("id" in job);
    assert.ok(await cancelJob(superActor, job.id));
    assert.ok("error" in (await commitJob(superActor, job.id)));
    assert.equal(await db.product.count({ where: { sku: "DT-K1" } }), 0);
  });
});

describe("exports", () => {
  it("every exporter streams its header and filtered rows; bad filters are reported", async () => {
    for (const ex of Object.values(EXPORTERS)) {
      const { filters, errors } = await ex.parseFilters(new URLSearchParams());
      assert.deepEqual(errors, []);
      const body = await exportResponse(ex, filters, FORMATS.csv, ex.entity).text();
      const table = parseCsv(body);
      assert.deepEqual(table[0], ex.headers, ex.entity);
      assert.equal(table.length - 1, await ex.count(filters), `${ex.entity} rows = count`);
    }
    const bad = await productExport.parseFilters(new URLSearchParams({ price_min: "abc", stock: "weird", cat: "nope" }));
    assert.equal(bad.errors.length, 3);
    const cust = await EXPORTERS.customers.parseFilters(new URLSearchParams({ from: "2026-13-45" }));
    assert.equal(cust.errors.length, 1);
  });

  it("pages through large results (more than one 500-row page)", async () => {
    await db.product.createMany({
      data: Array.from({ length: 1203 }, (_, i) => ({ slug: `dt-bulk-${i}`, sku: `DT-BULK-${i}`, name: `Bulk ${i}`, brand: "Bulk", categoryId: top, price: 1 })),
    });
    const { filters } = await productExport.parseFilters(new URLSearchParams({ sku: "DT-BULK-" }));
    const table = parseCsv(await exportResponse(productExport, filters, FORMATS.csv, "p").text());
    assert.equal(table.length - 1, 1203);
    assert.equal(new Set(table.slice(1).map((r) => r[0])).size, 1203, "no duplicates or gaps across pages");
  });

  it("price and stock filters", async () => {
    const { filters } = await productExport.parseFilters(new URLSearchParams({ sku: "DT-", price_min: "10", price_max: "60", stock: "out" }));
    const rows = parseCsv(await exportResponse(productExport, filters, FORMATS.csv, "p").text()).slice(1);
    assert.deepEqual(rows.map((r) => r[0]), ["DT-EXIST"]);
  });

  it("sample files have the import headers and import cleanly apart from unknown references", async () => {
    const rows = sampleRows(customerImport as ImportAdapter);
    const v = await validateCsv(customerImport as ImportAdapter, toCsv(rows), "add_update");
    assert.deepEqual(v.fileErrors, []);
    assert.equal(v.totals.errors, 0);
  });
});
