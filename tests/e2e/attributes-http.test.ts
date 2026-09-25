// Phase 16: attribute pages and actions over real HTTP against the running dev server. Only creates data it
// owns (attribute codes p16_…, emails p16-…@example.test, roles "P16 …") and deletes it afterwards.
// Run: docker compose exec app npm run test:e2e
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import * as staff from "@/lib/admin-users";
import { db } from "@/lib/db";
// React's client-side encoder for server action arguments (bundled with Next.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.edge.js") as { encodeReply: (v: unknown) => Promise<string | FormData> };

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PW = "P16-test-password-1";
const harness: staff.Actor = { id: "p16-harness", email: "p16-harness@example.test", isSuperAdmin: true, permissions: [] };

async function cleanup() {
  await db.attribute.deleteMany({ where: { code: { startsWith: "p16_" } } });
  await db.customer.deleteMany({ where: { email: { startsWith: "p16-", endsWith: "@example.test" } } });
  await db.adminRole.deleteMany({ where: { name: { startsWith: "P16 " } } });
  await db.adminAuditLog.deleteMany({ where: { OR: [{ actorEmail: { startsWith: "p16-" } }, { targetLabel: { startsWith: "p16-" } }, { targetLabel: { startsWith: "P16 " } }] } });
}

class Session {
  cookies = new Map<string, string>();
  async fetch(path: string, init: RequestInit = {}) {
    const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { ...(init.headers ?? {}), cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") } });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
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
    return s;
  }
}

const location = (res: Response) => new URL(res.headers.get("location") ?? "", BASE).pathname;

/** Action id by file and export name, from the dev server's manifest (the page using it must have compiled). */
function actionId(file: string, name: string) {
  const manifest = JSON.parse(readFileSync("/app/.next/server/server-reference-manifest.json", "utf8")) as { node: Record<string, { filename: string; exportedName: string }> };
  const hit = Object.entries(manifest.node).find(([, v]) => v.filename === file && v.exportedName === name);
  assert.ok(hit, `action ${name} not in the manifest`);
  return hit[0];
}

async function callAction(s: Session, page: string, id: string, args: unknown[]) {
  const body = await encodeReply(args);
  const headers: Record<string, string> = { "next-action": id, accept: "text/x-component", origin: BASE };
  if (typeof body === "string") headers["content-type"] = "text/plain;charset=UTF-8";
  return s.fetch(page, { method: "POST", headers, body });
}

const attributeForm = (code: string, name: string) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ code, name, type: "SELECT", required: "on", active: "on", showOnProduct: "on", sortOrder: "5", description: "", defaultValue: "", unit: "" })) f.append(k, v);
  return f;
};

before(async () => {
  await cleanup();
  const role = async (name: string, permissions: string[]) => (await staff.saveRole(harness, null, { name, description: "test", permissions })).id!;
  const add = async (key: string, roleId: string) => assert.ok((await staff.createAdminUser(harness, { name: `P16 ${key}`, email: `p16-${key}@example.test`, password: PW, roleId, active: true })).id);
  await add("editor", await role("P16 Attribute Editor", ["attributes.view", "attributes.create", "attributes.edit"]));
  await add("viewer", await role("P16 Attribute Viewer", ["attributes.view"]));
  await add("none", await role("P16 Products Only", ["products.view"]));
});

after(async () => {
  await cleanup();
  await db.$disconnect();
});

describe("attributes over HTTP", () => {
  it("pages follow the role", async () => {
    const none = await Session.login("p16-none@example.test");
    assert.equal(location(await none.fetch("/admin/attributes")), "/admin/forbidden");
    const viewer = await Session.login("p16-viewer@example.test");
    assert.equal((await viewer.fetch("/admin/attributes")).status, 200);
    assert.equal(location(await viewer.fetch("/admin/attributes/new")), "/admin/forbidden");
    const editor = await Session.login("p16-editor@example.test");
    assert.equal((await editor.fetch("/admin/attributes/new")).status, 200);
  });

  it("create, options and delete are refused when called directly without permission", async () => {
    const editor = await Session.login("p16-editor@example.test");
    await editor.fetch("/admin/attributes/new"); // compiles the page, so its actions are in the manifest
    const save = actionId("src/app/actions/attributes.ts", "saveAttribute");

    const viewer = await Session.login("p16-viewer@example.test");
    assert.equal((await callAction(viewer, "/admin/attributes/new", save, [{}, attributeForm("p16_blocked", "P16 blocked")])).status, 500);
    const none = await Session.login("p16-none@example.test");
    assert.equal((await callAction(none, "/admin/attributes/new", save, [{}, attributeForm("p16_blocked", "P16 blocked")])).status, 500);
    assert.equal(await db.attribute.count({ where: { code: "p16_blocked" } }), 0);

    await callAction(editor, "/admin/attributes/new", save, [{}, attributeForm("p16_ram", "P16 RAM")]);
    const attr = await db.attribute.findUniqueOrThrow({ where: { code: "p16_ram" } });
    assert.equal(attr.type, "SELECT");
    assert.equal(attr.sortOrder, 5);

    await editor.fetch(`/admin/attributes/${attr.id}`);
    const saveOptions = actionId("src/app/actions/attributes.ts", "saveAttributeOptions");
    const options = new FormData();
    for (const [label, def] of [["8 GB", "0"], ["16 GB", "1"]]) {
      options.append("o.id", "");
      options.append("o.label", label);
      options.append("o.active", "1");
      options.append("o.default", def);
    }
    assert.equal((await callAction(viewer, `/admin/attributes/${attr.id}`, saveOptions, [attr.id, {}, options])).status, 500);
    assert.equal(await db.attributeOption.count({ where: { attributeId: attr.id } }), 0);
    await callAction(editor, `/admin/attributes/${attr.id}`, saveOptions, [attr.id, {}, options]);
    assert.deepEqual((await db.attributeOption.findMany({ where: { attributeId: attr.id }, orderBy: { sortOrder: "asc" } })).map((o) => [o.label, o.isDefault]), [
      ["8 GB", false],
      ["16 GB", true],
    ]);

    const del = actionId("src/app/actions/attributes.ts", "deleteAttribute");
    assert.equal((await callAction(editor, `/admin/attributes/${attr.id}`, del, [attr.id, {}])).status, 500, "editor has no attributes.delete");
    assert.equal(await db.attribute.count({ where: { id: attr.id } }), 1);

    const toggle = actionId("src/app/actions/attributes.ts", "toggleAttribute");
    assert.equal((await callAction(viewer, "/admin/attributes", toggle, [attr.id, false])).status, 500);
    assert.equal((await db.attribute.findUniqueOrThrow({ where: { id: attr.id } })).active, true);
    await callAction(editor, "/admin/attributes", toggle, [attr.id, false]);
    assert.equal((await db.attribute.findUniqueOrThrow({ where: { id: attr.id } })).active, false);
  });
});
