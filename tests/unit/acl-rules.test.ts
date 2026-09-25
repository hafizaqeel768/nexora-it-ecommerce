// Phase 14: privilege-escalation rules (pure functions). Run: docker compose exec app npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_PERMISSIONS, can, canAny, cleanPermissions, isPermission, PERMISSION_GROUPS } from "@/lib/acl";
import {
  assignRoleDenial,
  editRoleDenial,
  lastSuperAdminDenial,
  manageAdminDenial,
  superAdminChangeDenial,
  withinActorPermissions,
} from "@/lib/acl-rules";

const superAdmin = { id: "s1", isSuperAdmin: true, permissions: [] };
const userManager = { id: "u1", isSuperAdmin: false, permissions: ["admin_users.view", "admin_users.create", "admin_users.edit", "roles.view", "roles.create", "roles.edit", "products.view"] };
const catalog = ["products.view", "products.edit"];
const everythingNormal = { id: "n1", isSuperAdmin: false, permissions: [...ALL_PERMISSIONS] };

describe("permission catalog", () => {
  it("has unique codes in module.action form and no super-admin permission", () => {
    assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length);
    for (const p of ALL_PERMISSIONS) assert.match(p, /^[a-z_]+\.[a-z_]+$/);
    assert.ok(!ALL_PERMISSIONS.some((p) => /super/i.test(p)));
    assert.equal(PERMISSION_GROUPS.reduce((n, g) => n + g.permissions.length, 0), ALL_PERMISSIONS.length);
  });
  it("cleans unknown and duplicate codes", () => {
    assert.deepEqual(cleanPermissions(["products.edit", "bogus", "products.view", "products.edit", "super_admin"]), ["products.view", "products.edit"]);
    assert.equal(isPermission("products.view"), true);
    assert.equal(isPermission("*"), false);
  });
  it("super admin can do everything; others only what they hold", () => {
    assert.ok(can(superAdmin, "roles.delete"));
    assert.ok(can(userManager, "admin_users.edit"));
    assert.ok(!can(userManager, "orders.view"));
    assert.ok(canAny(userManager, ["orders.view", "products.view"]));
    assert.ok(!canAny(userManager, ["orders.view"]));
  });
});

describe("manage admin users", () => {
  it("nobody manages their own account", () => {
    assert.ok(manageAdminDenial(superAdmin, { id: "s1", isSuperAdmin: true, permissions: [] }));
    assert.ok(manageAdminDenial(userManager, { id: "u1", isSuperAdmin: false, permissions: [] }));
  });
  it("only a super admin manages a super admin", () => {
    const target = { id: "s2", isSuperAdmin: true, permissions: [] };
    assert.ok(manageAdminDenial(userManager, target));
    assert.ok(manageAdminDenial(everythingNormal, target), "full normal ACL is not super admin");
    assert.equal(manageAdminDenial(superAdmin, target), null);
  });
  it("a normal admin can't manage someone with permissions they lack", () => {
    assert.ok(manageAdminDenial(userManager, { id: "x", isSuperAdmin: false, permissions: ["orders.refund"] }));
    assert.equal(manageAdminDenial(userManager, { id: "x", isSuperAdmin: false, permissions: ["products.view"] }), null);
    assert.equal(manageAdminDenial(userManager, { id: "x", isSuperAdmin: false, permissions: [] }), null);
  });
});

describe("assign roles", () => {
  it("normal admins can only assign roles within their own permissions", () => {
    assert.ok(assignRoleDenial(userManager, catalog), "products.edit is not theirs");
    assert.equal(assignRoleDenial(userManager, ["products.view"]), null);
    assert.equal(assignRoleDenial(superAdmin, [...ALL_PERMISSIONS]), null);
  });
  it("unknown codes in a role don't count (and can't smuggle anything)", () => {
    assert.equal(withinActorPermissions(userManager, ["products.view", "super_admin", "*"]), true);
  });
});

describe("edit roles", () => {
  it("can't add permissions the actor lacks", () => {
    assert.ok(editRoleDenial(userManager, [], ["orders.refund"]));
    assert.ok(editRoleDenial(userManager, ["products.view"], ["products.view", "admin_users.delete"]));
    assert.equal(editRoleDenial(userManager, [], ["products.view", "roles.view"]), null);
  });
  it("can't edit or delete a role stronger than the actor", () => {
    assert.ok(editRoleDenial(userManager, ["orders.refund"], []));
  });
  it("super admins can build any role", () => {
    assert.equal(editRoleDenial(superAdmin, ["orders.refund"], [...ALL_PERMISSIONS]), null);
  });
});

describe("super admin status", () => {
  it("only super admins grant or revoke it, never on themselves", () => {
    assert.ok(superAdminChangeDenial(userManager, "x"));
    assert.ok(superAdminChangeDenial(everythingNormal, "x"), "admin_users.* + roles.* still can't grant it");
    assert.ok(superAdminChangeDenial(superAdmin, "s1"));
    assert.equal(superAdminChangeDenial(superAdmin, "s2"), null);
  });
  it("the last active super admin is protected", () => {
    assert.ok(lastSuperAdminDenial(0));
    assert.equal(lastSuperAdminDenial(1), null);
  });
});
