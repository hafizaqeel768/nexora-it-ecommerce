// Phase 14: admin users, roles, super admin protection and audit log against a real (throwaway) database.
// Run: docker compose exec app npm run test:integration  (scripts/test-integration.mjs creates the database)
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ALL_PERMISSIONS } from "@/lib/acl";
import * as staff from "@/lib/admin-users";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Integration tests only run against a *_test database.");

const PW = "Correct-horse-1";
let root: staff.Actor; // the first super admin, as `admin:promote` would create
const actor = async (id: string) => {
  const a = await staff.loadActor(id);
  assert.ok(a, "actor should be an active admin");
  return a;
};
const auditCount = (action: string, targetId?: string) => db.adminAuditLog.count({ where: { action, ...(targetId ? { targetId } : {}) } });

before(async () => {
  const now = new Date();
  const c = await db.customer.create({
    data: { email: "root@example.test", name: "Root", role: "ADMIN", isSuperAdmin: true, passwordHash: "x", registeredAt: now, emailVerifiedAt: now },
  });
  root = await actor(c.id);
});

after(async () => {
  await db.$disconnect();
});

describe("roles", () => {
  it("creates a custom role, cleans permission codes, audits it", async () => {
    const r = await staff.saveRole(root, null, { name: "Product Editor", description: "Edits products", permissions: ["products.view", "products.edit", "bogus", "super_admin"] });
    assert.ok(r.ok && r.id, r.error);
    const role = await db.adminRole.findUniqueOrThrow({ where: { id: r.id } });
    assert.deepEqual(role.permissions, ["products.view", "products.edit"]);
    assert.equal(await auditCount("role.created", r.id), 1);
  });
  it("refuses 'Super Admin' as a role name and duplicate names", async () => {
    assert.ok((await staff.saveRole(root, null, { name: "Super Admin", description: "", permissions: [] })).error);
    assert.ok((await staff.saveRole(root, null, { name: "super-administrator", description: "", permissions: [] })).error);
    assert.ok((await staff.saveRole(root, null, { name: "product editor", description: "", permissions: [] })).error);
  });
  it("the migration's starter roles exist and are ordinary roles", async () => {
    const names = (await db.adminRole.findMany({ select: { name: true } })).map((r) => r.name);
    for (const n of ["Catalog Manager", "Sales Manager", "Customer Manager", "Content Manager", "Support"]) assert.ok(names.includes(n), n);
  });
});

describe("admin users and escalation", () => {
  let manager: staff.Actor; // admin_users.* + roles.* + products.view — but not super admin
  let managerRoleId: string;
  let editorRoleId: string;
  let refundRoleId: string;

  before(async () => {
    const m = await staff.saveRole(root, null, {
      name: "User Manager",
      description: "",
      permissions: ["admin_users.view", "admin_users.create", "admin_users.edit", "admin_users.disable", "admin_users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete", "products.view"],
    });
    managerRoleId = m.id!;
    editorRoleId = (await db.adminRole.findUniqueOrThrow({ where: { name: "Product Editor" } })).id;
    refundRoleId = (await staff.saveRole(root, null, { name: "Refunds", description: "", permissions: ["orders.view", "orders.refund"] })).id!;
    const u = await staff.createAdminUser(root, { name: "Manny", email: "Manny@Example.test", password: PW, roleId: managerRoleId, active: true });
    assert.ok(u.id, u.error);
    manager = await actor(u.id);
  });

  it("stores email lower-cased and the password hashed, never plain", async () => {
    const c = await db.customer.findUniqueOrThrow({ where: { id: manager.id } });
    assert.equal(c.email, "manny@example.test");
    assert.notEqual(c.passwordHash, PW);
    assert.ok(c.passwordHash?.startsWith("scrypt$"));
    assert.ok(await verifyPassword(PW, c.passwordHash!));
    assert.equal(c.isSuperAdmin, false);
  });

  it("validates input", async () => {
    const r = await staff.createAdminUser(root, { name: "", email: "nope", password: "short", roleId: "" });
    assert.ok(r.fields?.name && r.fields?.email && r.fields?.password && r.fields?.roleId);
    const weak = await staff.createAdminUser(root, { name: "A", email: "a@example.test", password: "onlyletters", roleId: editorRoleId });
    assert.ok(weak.fields?.password);
    const dup = await staff.createAdminUser(root, { name: "Dup", email: "manny@example.test", password: PW, roleId: editorRoleId });
    assert.ok(dup.fields?.email);
  });

  it("a user manager can't create a super admin or assign a stronger role", async () => {
    const sup = await staff.createAdminUser(manager, { name: "X", email: "x1@example.test", password: PW, roleId: "", superAdmin: true });
    assert.match(sup.error ?? "", /super admin/i);
    const stronger = await staff.createAdminUser(manager, { name: "X", email: "x2@example.test", password: PW, roleId: editorRoleId });
    assert.ok(stronger.error, "Product Editor has products.edit, which the manager lacks");
    assert.equal(await db.customer.count({ where: { email: { in: ["x1@example.test", "x2@example.test"] } } }), 0);
  });

  it("a user manager can't change their own role, status, password or delete themselves", async () => {
    assert.ok((await staff.updateAdminUser(manager, manager.id, { name: "Manny", email: "manny@example.test", roleId: editorRoleId })).error);
    assert.ok((await staff.setAdminActive(manager, manager.id, false)).error);
    assert.ok((await staff.resetAdminPassword(manager, manager.id, "Another-pass-2")).error);
    assert.ok((await staff.deleteAdminUser(manager, manager.id)).error);
    assert.ok((await staff.setSuperAdmin(manager, manager.id, true)).error);
  });

  it("a user manager can't widen their own role or create a role with more than they have", async () => {
    const widen = await staff.saveRole(manager, managerRoleId, {
      name: "User Manager",
      description: "",
      permissions: ["admin_users.view", "admin_users.create", "admin_users.edit", "admin_users.disable", "admin_users.delete", "roles.view", "roles.create", "roles.edit", "roles.delete", "products.view", "orders.refund"],
    });
    assert.ok(widen.error);
    const all = await staff.saveRole(manager, null, { name: "Everything", description: "", permissions: [...ALL_PERMISSIONS] });
    assert.ok(all.error);
    const role = await db.adminRole.findUniqueOrThrow({ where: { id: managerRoleId } });
    assert.ok(!role.permissions.includes("orders.refund"));
  });

  it("a user manager can't edit or delete a stronger role", async () => {
    assert.ok((await staff.saveRole(manager, refundRoleId, { name: "Refunds", description: "", permissions: [] })).error);
    assert.ok((await staff.deleteRole(manager, refundRoleId)).error);
  });

  it("a user manager can create a role within their permissions and assign it", async () => {
    const viewer = await staff.saveRole(manager, null, { name: "Product Viewer", description: "", permissions: ["products.view"] });
    assert.ok(viewer.id, viewer.error);
    const u = await staff.createAdminUser(manager, { name: "Vera", email: "vera@example.test", password: PW, roleId: viewer.id!, active: true });
    assert.ok(u.id, u.error);
    const vera = await actor(u.id);
    assert.deepEqual(vera.permissions, ["products.view"]);
    // …but can't touch the super admin
    assert.ok((await staff.setAdminActive(manager, root.id, false)).error);
    assert.ok((await staff.resetAdminPassword(manager, root.id, "Hijack-pass-9")).error);
    assert.ok((await staff.updateAdminUser(manager, root.id, { name: "Root", email: "root@example.test", roleId: viewer.id! })).error);
    assert.ok((await staff.deleteAdminUser(manager, root.id)).error);
  });

  it("assignableRoles never offers roles beyond the actor, and super admin is never a role", async () => {
    const names = (await staff.assignableRoles(manager)).map((r) => r.name);
    assert.ok(names.includes("Product Viewer"));
    assert.ok(!names.includes("Product Editor"));
    assert.ok(!names.includes("Refunds"));
    assert.ok(!names.some((n) => /super/i.test(n)));
    assert.equal((await staff.assignableRoles(root)).length, await db.adminRole.count());
  });

  it("a restricted admin without admin_users/roles permissions is refused by the service", async () => {
    const vera = await actor((await db.customer.findUniqueOrThrow({ where: { email: "vera@example.test" } })).id);
    assert.match((await staff.createAdminUser(vera, { name: "Z", email: "z@example.test", password: PW, roleId: editorRoleId })).error ?? "", /permission/);
    assert.match((await staff.saveRole(vera, null, { name: "Z", description: "", permissions: [] })).error ?? "", /permission/);
    assert.match((await staff.setAdminActive(vera, manager.id, false)).error ?? "", /permission/);
  });

  it("role changes apply immediately to members", async () => {
    const viewerRole = await db.adminRole.findUniqueOrThrow({ where: { name: "Product Viewer" } });
    const r = await staff.saveRole(root, viewerRole.id, { name: "Product Viewer", description: "", permissions: ["products.view", "roles.view"] });
    assert.ok(r.ok, r.error);
    const vera = await actor((await db.customer.findUniqueOrThrow({ where: { email: "vera@example.test" } })).id);
    assert.deepEqual(vera.permissions, ["products.view", "roles.view"]);
    const log = await db.adminAuditLog.findFirstOrThrow({ where: { action: "role.updated", targetId: viewerRole.id }, orderBy: { createdAt: "desc" } });
    assert.deepEqual((log.details as { added: string[] }).added, ["roles.view"]);
  });

  it("disabling signs the admin out (loadActor → null), enabling restores", async () => {
    const vera = await db.customer.findUniqueOrThrow({ where: { email: "vera@example.test" } });
    assert.ok((await staff.setAdminActive(manager, vera.id, false)).ok);
    assert.equal(await staff.loadActor(vera.id), null);
    assert.ok((await staff.setAdminActive(manager, vera.id, true)).ok);
    assert.ok(await staff.loadActor(vera.id));
    assert.equal(await auditCount("admin_user.disabled", vera.id), 1);
    assert.equal(await auditCount("admin_user.enabled", vera.id), 1);
  });

  it("password reset changes the hash, bumps passwordChangedAt, audit has no password", async () => {
    const before = await db.customer.findUniqueOrThrow({ where: { email: "vera@example.test" } });
    const r = await staff.resetAdminPassword(manager, before.id, "New-password-77");
    assert.ok(r.ok, r.error);
    const after = await db.customer.findUniqueOrThrow({ where: { id: before.id } });
    assert.ok(await verifyPassword("New-password-77", after.passwordHash!));
    assert.ok(after.passwordChangedAt! > (before.passwordChangedAt ?? new Date(0)));
    const logs = await db.adminAuditLog.findMany();
    for (const l of logs) assert.ok(!JSON.stringify(l).includes("New-password-77") && !JSON.stringify(l).includes(PW), "no password in the audit log");
  });

  it("a role in use can't be deleted", async () => {
    const r = await staff.deleteRole(root, managerRoleId);
    assert.match(r.error ?? "", /another role first/);
  });
});

describe("protected super admin", () => {
  let second: string;

  it("only a super admin can grant super admin; the audit log records it", async () => {
    const u = await staff.createAdminUser(root, { name: "Sue", email: "sue@example.test", password: PW, roleId: "", superAdmin: true, active: true });
    assert.ok(u.id, u.error);
    second = u.id!;
    assert.equal((await actor(second)).isSuperAdmin, true);
    assert.equal(await auditCount("admin_user.super_admin_granted", second), 1);
    const manny = await actor((await db.customer.findUniqueOrThrow({ where: { email: "manny@example.test" } })).id);
    const vera = (await db.customer.findUniqueOrThrow({ where: { email: "vera@example.test" } })).id;
    assert.ok((await staff.setSuperAdmin(manny, vera, true)).error);
    assert.equal((await db.customer.findUniqueOrThrow({ where: { id: vera } })).isSuperAdmin, false);
  });

  it("a super admin can't remove their own super admin status", async () => {
    assert.ok((await staff.setSuperAdmin(root, root.id, false)).error);
  });

  it("the last active super admin can't be disabled, deleted or demoted", async () => {
    const sue = await actor(second);
    // Two super admins: Sue may disable Root…
    assert.ok((await staff.setAdminActive(sue, root.id, false)).ok);
    // …now Sue is the last active one: Root (disabled) can't act, and nobody can remove Sue.
    assert.equal(await staff.loadActor(root.id), null);
    const rootRow = await db.customer.findUniqueOrThrow({ where: { id: root.id } });
    const disabledRoot: staff.Actor = { id: rootRow.id, email: rootRow.email, isSuperAdmin: true, permissions: [] };
    // Even if a stale session of Root got through, the database check still protects the last super admin:
    assert.match((await staff.setAdminActive(disabledRoot, second, false)).error ?? "", /last active super admin/);
    assert.match((await staff.deleteAdminUser(disabledRoot, second)).error ?? "", /last active super admin/);
    assert.match((await staff.setSuperAdmin(disabledRoot, second, false)).error ?? "", /last active super admin/);
    assert.ok((await actor(second)).isSuperAdmin);
    // Re-enable Root.
    assert.ok((await staff.setAdminActive(sue, root.id, true)).ok);
  });

  it("concurrent removals can't leave zero super admins", async () => {
    const sue = await actor(second);
    const [a, b] = await Promise.all([staff.setAdminActive(root, second, false), staff.setAdminActive(sue, root.id, false)]);
    const ok = [a, b].filter((r) => r.ok).length;
    assert.equal(ok, 1, `exactly one of the two should win: ${JSON.stringify([a, b])}`);
    const active = await db.customer.count({ where: { isSuperAdmin: true, adminDisabledAt: null } });
    assert.equal(active, 1);
    // restore both
    await db.customer.updateMany({ where: { id: { in: [root.id, second] } }, data: { adminDisabledAt: null } });
  });

  it("the database refuses super admin / role on a customer account", async () => {
    const c = await db.customer.create({ data: { email: "shopper@example.test", name: "Shopper" } });
    await assert.rejects(db.customer.update({ where: { id: c.id }, data: { isSuperAdmin: true } }));
    const role = await db.adminRole.findFirstOrThrow();
    await assert.rejects(db.customer.update({ where: { id: c.id }, data: { adminRoleId: role.id } }));
  });

  it("super admin removal falls back to the role; needs a role first", async () => {
    assert.match((await staff.setSuperAdmin(root, second, false)).error ?? "", /role first/);
    const role = await db.adminRole.findUniqueOrThrow({ where: { name: "Product Viewer" } });
    assert.ok((await staff.updateAdminUser(root, second, { name: "Sue", email: "sue@example.test", roleId: role.id })).ok);
    assert.ok((await staff.setSuperAdmin(root, second, false)).ok);
    const sue = await actor(second);
    assert.equal(sue.isSuperAdmin, false);
    assert.deepEqual(sue.permissions, ["products.view", "roles.view"]);
  });
});

describe("delete admin users", () => {
  it("deletes an admin without history", async () => {
    const u = await staff.createAdminUser(root, { name: "Temp", email: "temp@example.test", password: PW, roleId: (await db.adminRole.findFirstOrThrow()).id });
    assert.ok((await staff.deleteAdminUser(root, u.id!)).ok);
    assert.equal(await db.customer.count({ where: { id: u.id } }), 0);
    assert.equal(await auditCount("admin_user.deleted", u.id), 1);
  });

  it("keeps an admin with orders as a customer record without login", async () => {
    const u = await staff.createAdminUser(root, { name: "Buyer", email: "buyer@example.test", password: PW, roleId: (await db.adminRole.findFirstOrThrow()).id });
    await db.order.create({
      data: {
        number: "TEST-1",
        customerId: u.id,
        name: "Buyer",
        email: "buyer@example.test",
        addressLine: "1 St",
        city: "X",
        state: "TX",
        postalCode: "1",
        country: "United States",
        paymentMethod: "PURCHASE_ORDER",
        subtotal: 1,
        total: 1,
      },
    });
    assert.ok((await staff.deleteAdminUser(root, u.id!)).ok);
    const c = await db.customer.findUniqueOrThrow({ where: { id: u.id } });
    assert.equal(c.role, "CUSTOMER");
    assert.equal(c.passwordHash, null);
    assert.equal(c.adminRoleId, null);
    assert.equal(await db.order.count({ where: { customerId: u.id } }), 1);
  });

  it("creating an admin from a guest-checkout email keeps the guest's orders", async () => {
    const guest = await db.customer.create({ data: { email: "guest@example.test", name: "Guest" } });
    const u = await staff.createAdminUser(root, { name: "Guest Staff", email: "guest@example.test", password: PW, roleId: (await db.adminRole.findFirstOrThrow()).id });
    assert.equal(u.id, guest.id);
  });
});
