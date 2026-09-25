// Phase 14: backend ACL over real HTTP against the running dev server (nexora_app, port 3100).
// Run: docker compose exec app npm run test:e2e
//
// It logs in as test-owned staff accounts and checks pages, CSV exports and server actions posted directly
// (the way a crafted request would, without the UI). It only creates and changes data it owns
// (emails p14-…@example.test, roles "P14 …", product SKU P14-HTTP) and deletes all of it afterwards.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Actor } from "@/lib/admin-users";
import * as staff from "@/lib/admin-users";
import { db } from "@/lib/db";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PW = "P14-test-password-1";
// Setup runs as a synthetic super admin so the real admin accounts never appear in the audit log.
const harness: Actor = { id: "p14-harness", email: "p14-harness@example.test", isSuperAdmin: true, permissions: [] };
const ids: Record<string, string> = {};
let productId = "";

async function cleanup() {
  await db.customer.deleteMany({ where: { email: { startsWith: "p14-", endsWith: "@example.test" } } });
  await db.adminRole.deleteMany({ where: { name: { startsWith: "P14 " } } });
  await db.product.deleteMany({ where: { sku: "P14-HTTP" } });
  await db.adminAuditLog.deleteMany({
    where: { OR: [{ actorEmail: { startsWith: "p14-" } }, { targetLabel: { startsWith: "p14-" } }, { targetLabel: { startsWith: "P14 " } }] },
  });
}

/** Cookie jar per signed-in user. */
class Session {
  cookies = new Map<string, string>();
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  get header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async fetch(path: string, init: RequestInit = {}) {
    const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { ...(init.headers ?? {}), cookie: this.header } });
    this.store(res);
    return res;
  }
  static async login(email: string, password = PW) {
    const s = new Session();
    const { csrfToken } = (await (await s.fetch("/api/auth/csrf")).json()) as { csrfToken: string };
    await s.fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/account` }),
    });
    return s;
  }
  get signedIn() {
    return [...this.cookies.keys()].some((k) => k.endsWith("authjs.session-token"));
  }
}

const location = (res: Response) => new URL(res.headers.get("location") ?? "", BASE).pathname;

/** The server action id behind a form on the page (from its no-JavaScript fallback fields), found by a marker. */
function actionId(html: string, marker: string) {
  const forms = html.match(/<form[\s\S]*?<\/form>/g) ?? [];
  const form = forms.find((f) => f.includes(marker));
  assert.ok(form, `form with ${marker} not found`);
  const id = /&quot;id&quot;:&quot;([0-9a-f]+)&quot;/.exec(form)?.[1];
  assert.ok(id, "no server action id in the form");
  return id;
}

/** Calls a server action directly, like the browser's JavaScript does (Next-Action header + encoded arguments). */
function callAction(s: Session, page: string, id: string, args: unknown[]) {
  return s.fetch(page, {
    method: "POST",
    headers: { "next-action": id, "content-type": "text/plain;charset=UTF-8", accept: "text/x-component", origin: BASE },
    body: JSON.stringify(args),
  });
}

before(async () => {
  await cleanup();
  const role = async (name: string, permissions: string[]) => (await staff.saveRole(harness, null, { name, description: "test", permissions })).id!;
  const viewer = await role("P14 Product Viewer", ["products.view"]);
  const empty = await role("P14 No Permissions", []);
  const sales = (await db.adminRole.findUniqueOrThrow({ where: { name: "Sales Manager" } })).id;
  const userMgr = await role("P14 User Manager", ["admin_users.view", "admin_users.edit", "admin_users.disable", "admin_users.delete", "products.view"]);
  const add = async (key: string, roleId: string, extra: Partial<Parameters<typeof staff.createAdminUser>[1]> = {}) => {
    const r = await staff.createAdminUser(harness, { name: `P14 ${key}`, email: `p14-${key}@example.test`, password: PW, roleId, active: true, ...extra });
    assert.ok(r.id, r.error);
    ids[key] = r.id!;
  };
  await add("super", "", { superAdmin: true });
  await add("viewer", viewer);
  await add("nobody", empty);
  await add("sales", sales);
  await add("usermgr", userMgr);
  await add("disabled", viewer, { active: false });
  await add("target", viewer);
  const now = new Date();
  const { hashPassword } = await import("@/lib/password");
  ids.customer = (
    await db.customer.create({
      data: { email: "p14-customer@example.test", name: "P14 customer", passwordHash: await hashPassword(PW), registeredAt: now, emailVerifiedAt: now },
    })
  ).id;
  const category = await db.category.findFirstOrThrow({ where: { parentId: { not: null } }, select: { id: true } });
  productId = (
    await db.product.create({
      data: { slug: "p14-http-test-product", sku: "P14-HTTP", name: "P14 HTTP test product", brand: "P14", categoryId: category.id, price: 1, status: "DRAFT" },
    })
  ).id;
});

after(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("login and account status", () => {
  it("a disabled admin can't log in", async () => {
    const s = await Session.login("p14-disabled@example.test");
    assert.equal(s.signedIn, false);
  });
  it("a customer is sent to 'no access'", async () => {
    const s = await Session.login("p14-customer@example.test");
    assert.ok(s.signedIn);
    const res = await s.fetch("/admin/products");
    assert.equal(location(res), "/no-access");
  });
  it("signed out → login", async () => {
    const res = await new Session().fetch("/admin/users");
    assert.equal(location(res), "/login");
  });
  it("last login is recorded", async () => {
    const c = await db.customer.findUniqueOrThrow({ where: { id: ids.viewer }, select: { lastLoginAt: true } });
    const before = c.lastLoginAt?.getTime() ?? 0;
    await Session.login("p14-viewer@example.test");
    const after = await db.customer.findUniqueOrThrow({ where: { id: ids.viewer }, select: { lastLoginAt: true } });
    assert.ok((after.lastLoginAt?.getTime() ?? 0) > before);
  });
});

describe("pages and exports follow the role", () => {
  it("product viewer: products yes; orders, users, roles, settings, exports no", async () => {
    const s = await Session.login("p14-viewer@example.test");
    assert.equal((await s.fetch("/admin/products")).status, 200);
    for (const p of ["/admin/orders", "/admin/users", "/admin/roles", "/admin/audit", "/admin/settings", "/admin/customers", "/admin/products/new", "/admin/users/new"]) {
      assert.equal(location(await s.fetch(p)), "/admin/forbidden", p);
    }
    assert.equal(location(await s.fetch("/admin")), "/admin/products", "no dashboard → first allowed section");
    for (const e of ["products", "orders", "customers"]) assert.equal((await s.fetch(`/admin/export/${e}`)).status, 404, e);
  });
  it("no permissions: every section is forbidden", async () => {
    const s = await Session.login("p14-nobody@example.test");
    assert.equal(location(await s.fetch("/admin")), "/admin/forbidden");
    assert.equal((await s.fetch("/admin/forbidden")).status, 200);
    assert.equal(location(await s.fetch("/admin/products")), "/admin/forbidden");
  });
  it("sales manager: orders + orders export, not products or users", async () => {
    const s = await Session.login("p14-sales@example.test");
    assert.equal((await s.fetch("/admin/orders")).status, 200);
    const csv = await s.fetch("/admin/export/orders");
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
    assert.equal(location(await s.fetch("/admin/products")), "/admin/forbidden");
    assert.equal((await s.fetch("/admin/export/products")).status, 404);
    assert.equal(location(await s.fetch("/admin/users")), "/admin/forbidden");
  });
  it("super admin: every system page opens", async () => {
    const s = await Session.login("p14-super@example.test");
    for (const p of ["/admin", "/admin/users", "/admin/users/new", `/admin/users/${ids.viewer}`, "/admin/roles", "/admin/roles/new", "/admin/audit", "/admin/products", "/admin/settings"]) {
      assert.equal((await s.fetch(p)).status, 200, p);
    }
  });
});

describe("server actions posted directly are refused without the permission", () => {
  it("toggle product (products.edit): refused for a product viewer and a customer; works for a super admin", async () => {
    const sup = await Session.login("p14-super@example.test");
    const page = "/admin/products?q=P14-HTTP";
    const id = actionId(await (await sup.fetch(page)).text(), "P14 HTTP test product: draft");
    const status = async () => (await db.product.findUniqueOrThrow({ where: { id: productId } })).status;

    const viewer = await Session.login("p14-viewer@example.test");
    assert.equal((await callAction(viewer, page, id, [productId])).status, 500);
    assert.equal(await status(), "DRAFT", "viewer must not change it");

    const customer = await Session.login("p14-customer@example.test");
    assert.equal((await callAction(customer, page, id, [productId])).status, 500);
    assert.equal(await status(), "DRAFT", "customer must not change it");

    assert.equal((await callAction(new Session(), page, id, [productId])).status, 500);
    assert.equal(await status(), "DRAFT", "signed out must not change it");

    assert.equal((await callAction(sup, page, id, [productId])).status, 200);
    assert.equal(await status(), "ACTIVE", "super admin's call works, so the refusals above are real");
  });

  it("disable admin (admin_users.disable): refused for sales; works for a super admin", async () => {
    const sup = await Session.login("p14-super@example.test");
    const page = `/admin/users/${ids.target}`;
    const id = actionId(await (await sup.fetch(page)).text(), "Disable account");
    const disabled = async () => (await db.customer.findUniqueOrThrow({ where: { id: ids.target } })).adminDisabledAt;

    const sales = await Session.login("p14-sales@example.test");
    assert.equal((await callAction(sales, page, id, [ids.target, false, {}])).status, 500);
    assert.equal(await disabled(), null, "sales has no admin_users.disable");

    assert.equal((await callAction(sup, page, id, [ids.target, false, {}])).status, 200);
    assert.notEqual(await disabled(), null, "super admin can disable");
    await db.customer.update({ where: { id: ids.target }, data: { adminDisabledAt: null } });
  });

  it("a user manager can't disable a super admin or grant super admin, even calling the actions directly", async () => {
    const sup = await Session.login("p14-super@example.test");
    const mgr = await Session.login("p14-usermgr@example.test");
    const disableId = actionId(await (await sup.fetch(`/admin/users/${ids.target}`)).text(), "Disable account");
    const grantId = actionId(await (await sup.fetch(`/admin/users/${ids.target}`)).text(), "Make super admin");

    // The action runs but the service refuses (it returns an error message, so the status is 200).
    await callAction(mgr, `/admin/users/${ids.super}`, disableId, [ids.super, false, {}]);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: ids.super } })).adminDisabledAt, null);

    await callAction(mgr, `/admin/users/${ids.target}`, grantId, [ids.target, true, {}]);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: ids.target } })).isSuperAdmin, false);
    await callAction(mgr, `/admin/users/${ids.usermgr}`, grantId, [ids.usermgr, true, {}]);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: ids.usermgr } })).isSuperAdmin, false, "can't make themselves super admin");

    // Sanity: the same grant call by a super admin works.
    await callAction(sup, `/admin/users/${ids.target}`, grantId, [ids.target, true, {}]);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: ids.target } })).isSuperAdmin, true);
  });

  it("a disabled admin's existing session stops working at once", async () => {
    const s = await Session.login("p14-viewer@example.test");
    assert.equal((await s.fetch("/admin/products")).status, 200);
    await db.customer.update({ where: { id: ids.viewer }, data: { adminDisabledAt: new Date() } });
    assert.equal(location(await s.fetch("/admin/products")), "/login");
    await db.customer.update({ where: { id: ids.viewer }, data: { adminDisabledAt: null } });
  });
});
