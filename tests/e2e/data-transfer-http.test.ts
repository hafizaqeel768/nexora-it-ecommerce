// Phase 15: Data Transfer over real HTTP against the running dev server (permissions, direct server-action calls,
// import preview → confirm, downloads). Only creates data it owns (SKUs P15-…, emails p15-…@example.test,
// roles "P15 …") and deletes it afterwards. Run: docker compose exec app npm run test:e2e
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { parseCsv, toCsv } from "@/lib/csv";
import * as staff from "@/lib/admin-users";
// React's client-side encoder for server action arguments (bundled with Next.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.edge.js") as { encodeReply: (v: unknown) => Promise<string | FormData> };
import { db } from "@/lib/db";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PW = "P15-test-password-1";
const harness: staff.Actor = { id: "p15-harness", email: "p15-harness@example.test", isSuperAdmin: true, permissions: [] };
let categorySlug = "";

async function cleanup() {
  await db.product.deleteMany({ where: { sku: { startsWith: "P15-" } } });
  await db.importJob.deleteMany({ where: { createdByEmail: { startsWith: "p15-" } } });
  await db.customer.deleteMany({ where: { email: { startsWith: "p15-", endsWith: "@example.test" } } });
  await db.adminRole.deleteMany({ where: { name: { startsWith: "P15 " } } });
  await db.adminAuditLog.deleteMany({
    where: { OR: [{ actorEmail: { startsWith: "p15-" } }, { targetLabel: { startsWith: "p15-" } }, { targetLabel: { startsWith: "P15 " } }] },
  });
}

class Session {
  cookies = new Map<string, string>();
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  async fetch(path: string, init: RequestInit = {}) {
    const res = await fetch(BASE + path, {
      redirect: "manual",
      ...init,
      headers: { ...(init.headers ?? {}), cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
    });
    this.store(res);
    return res;
  }
  static async login(email: string) {
    const s = new Session();
    const { csrfToken } = (await (await s.fetch("/api/auth/csrf")).json()) as { csrfToken: string };
    await s.fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email, password: PW, callbackUrl: `${BASE}/account` }),
    });
    assert.ok([...s.cookies.keys()].some((k) => k.endsWith("authjs.session-token")), `login ${email}`);
    return s;
  }
}

const location = (res: Response) => new URL(res.headers.get("location") ?? "", BASE).pathname;

/** Server action id in a page's form (plain `$ACTION_ID_…` or bound `$ACTION_1:0` JSON), found by a marker. */
function actionId(html: string, marker: string) {
  const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(marker));
  assert.ok(form, `form with ${marker} not found`);
  const id = /\$ACTION_ID_([0-9a-f]+)/.exec(form)?.[1] ?? /&quot;id&quot;:&quot;([0-9a-f]+)&quot;/.exec(form)?.[1];
  assert.ok(id, "no server action id");
  return id;
}

/** Calls a server action exactly like the browser does: Next-Action header + React's own argument encoding. */
async function callAction(s: Session, page: string, id: string, args: unknown[]) {
  const body = await encodeReply(args);
  const headers: Record<string, string> = { "next-action": id, accept: "text/x-component", origin: BASE };
  if (typeof body === "string") headers["content-type"] = "text/plain;charset=UTF-8";
  return s.fetch(page, { method: "POST", headers, body });
}

const importCsv = (cat: string) =>
  toCsv([
    ["SKU", "Name", "Brand", "Category", "Price", "Stock", "Status"],
    ["P15-A", "P15 product A", "P15", cat, "12.50", "4", "draft"],
    ["P15-B", "P15 product B", "P15", cat, "20", "", "draft"],
    ["P15-C", "P15 broken", "P15", cat, "not a price", "", "draft"],
  ]);

const uploadForm = (csv: string, name = "p15.csv", type = "text/csv") => {
  const f = new FormData();
  f.append("entity", "products");
  f.append("behavior", "add_update");
  f.append("onError", "skip");
  f.append("file", new File([csv], name, { type }));
  return f;
};

before(async () => {
  await cleanup();
  categorySlug = (await db.category.findFirstOrThrow({ where: { parentId: { not: null } }, select: { slug: true } })).slug;
  const role = async (name: string, permissions: string[]) => (await staff.saveRole(harness, null, { name, description: "test", permissions })).id!;
  const add = async (key: string, roleId: string) => {
    const r = await staff.createAdminUser(harness, { name: `P15 ${key}`, email: `p15-${key}@example.test`, password: PW, roleId, active: true });
    assert.ok(r.id, r.error);
  };
  await add("catalog", await role("P15 Catalog", ["products.view", "import.access", "products.import", "export.access", "products.export"]));
  await add("viewer", await role("P15 Viewer", ["products.view"]));
  await add("sales", await role("P15 Sales", ["orders.view", "orders.export", "export.access"]));
});

after(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("Data Transfer access", () => {
  it("a role without Data Transfer permissions gets 'no permission' pages and 404 downloads", async () => {
    const s = await Session.login("p15-viewer@example.test");
    for (const p of ["/admin/data-transfer/import", "/admin/data-transfer/export", "/admin/data-transfer"]) assert.equal(location(await s.fetch(p)), "/admin/forbidden", p);
    for (const p of ["/admin/data-transfer/export/products", "/admin/data-transfer/sample/products", "/admin/export/products"]) assert.equal((await s.fetch(p)).status, 404, p);
  });

  it("each entity needs its own permission", async () => {
    const s = await Session.login("p15-catalog@example.test");
    assert.equal((await s.fetch("/admin/data-transfer/import")).status, 200);
    assert.equal((await s.fetch("/admin/data-transfer/export?entity=products")).status, 200);
    const sample = await s.fetch("/admin/data-transfer/sample/products");
    assert.equal(sample.status, 200);
    assert.deepEqual(parseCsv(await sample.text())[0].slice(0, 3), ["SKU", "URL slug", "Name"]);
    for (const p of ["/admin/data-transfer/sample/customers", "/admin/data-transfer/export/orders", "/admin/data-transfer/export/customers", "/admin/data-transfer/sample/orders"]) {
      assert.equal((await s.fetch(p)).status, 404, p);
    }
    const sales = await Session.login("p15-sales@example.test");
    assert.equal(location(await sales.fetch("/admin/data-transfer/import")), "/admin/forbidden");
    const orders = await sales.fetch("/admin/data-transfer/export/orders?status=PENDING");
    assert.equal(orders.status, 200);
    assert.equal(parseCsv(await orders.text())[0][0], "Order");
    assert.equal((await sales.fetch("/admin/data-transfer/export/orders?from=not-a-date")).status, 400);
  });
});

describe("import over HTTP", () => {
  let jobId = "";

  it("validate & preview writes nothing and needs the permission, even when called directly", async () => {
    const cat = await Session.login("p15-catalog@example.test");
    const id = actionId(await (await cat.fetch("/admin/data-transfer/import")).text(), "Validate &amp; preview");

    const viewer = await Session.login("p15-viewer@example.test");
    await callAction(viewer, "/admin/data-transfer/import", id, [{}, uploadForm(importCsv(categorySlug))]);
    assert.equal(await db.importJob.count({ where: { createdByEmail: "p15-viewer@example.test" } }), 0);

    const bad = await callAction(cat, "/admin/data-transfer/import", id, [{}, uploadForm("MZ\u0000binary", "evil.exe", "application/x-msdownload")]);
    assert.equal(bad.status, 200);
    assert.match(await bad.text(), /Only \.csv files/);

    await callAction(cat, "/admin/data-transfer/import", id, [{}, uploadForm(importCsv(categorySlug))]);
    const job = await db.importJob.findFirstOrThrow({ where: { createdByEmail: "p15-catalog@example.test" }, orderBy: { createdAt: "desc" } });
    jobId = job.id;
    assert.equal(job.status, "VALIDATED");
    assert.deepEqual(job.totals, { rows: 3, valid: 2, warnings: 0, errors: 1, create: 2, update: 0, skip: 0 });
    assert.equal(await db.product.count({ where: { sku: { startsWith: "P15-" } } }), 0);

    const page = await (await cat.fetch(`/admin/data-transfer/import/${jobId}`)).text();
    assert.match(page, /Row <!-- -->?4|Row 4/);
    assert.match(page, /is not an amount/);
  });

  it("confirm is refused for other roles; works once for the uploader's role", async () => {
    const cat = await Session.login("p15-catalog@example.test");
    const page = `/admin/data-transfer/import/${jobId}`;
    const confirmId = actionId(await (await cat.fetch(page)).text(), "Confirm import");

    const sales = await Session.login("p15-sales@example.test");
    assert.equal((await callAction(sales, page, confirmId, [jobId, {}])).status, 500);
    assert.equal(await db.product.count({ where: { sku: { startsWith: "P15-" } } }), 0);
    assert.equal((await sales.fetch(`${page}/errors`)).status, 404, "error report is private too");

    await callAction(cat, page, confirmId, [jobId, {}]);
    assert.equal(await db.product.count({ where: { sku: { in: ["P15-A", "P15-B"] } } }), 2);
    const again = await callAction(cat, page, confirmId, [jobId, {}]);
    assert.match(await again.text(), /already run/);
    assert.equal(await db.product.count({ where: { sku: { startsWith: "P15-" } } }), 2);

    const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } });
    assert.deepEqual(job.result, { created: 2, updated: 0, skipped: 0, failed: 1 });
    const report = await cat.fetch(`${page}/errors`);
    assert.equal(report.status, 200);
    const rows = parseCsv(await report.text());
    assert.deepEqual(rows.map((r) => r[1]), ["SKU", "P15-C"]);
  });

  it("the Products list export link uses the new export and round-trips", async () => {
    const cat = await Session.login("p15-catalog@example.test");
    const res = await cat.fetch("/admin/export/products?q=P15-");
    assert.equal(res.status, 200);
    const table = parseCsv(await res.text());
    assert.deepEqual(table.slice(1).map((r) => r[0]).sort(), ["P15-A", "P15-B"]);
    assert.equal(location(await cat.fetch("/admin/products/import")), "/admin/data-transfer/import", "old import page redirects");
    const log = await db.adminAuditLog.count({ where: { actorEmail: "p15-catalog@example.test", action: { in: ["data.exported", "data.imported"] } } });
    assert.ok(log >= 2, "imports and exports are in the activity log");
  });
});
