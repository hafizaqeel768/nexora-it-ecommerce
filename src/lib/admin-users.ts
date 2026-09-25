// Admin users and roles (Phase 14): every change to staff accounts and roles goes through here.
// Each function checks the actor's permission AND the escalation rules (src/lib/acl-rules.ts) itself, runs in
// a transaction and writes the audit log in the same transaction. The server actions in
// src/app/actions/admin-users.ts only resolve the signed-in actor and refresh pages; the tests call these directly.
import type { Prisma } from "@/generated/prisma/client";
import { can, cleanPermissions, type AdminAccess, type Permission } from "@/lib/acl";
import {
  assignRoleDenial,
  editRoleDenial,
  lastSuperAdminDenial,
  manageAdminDenial,
  superAdminChangeDenial,
  withinActorPermissions,
} from "@/lib/acl-rules";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export type Actor = AdminAccess & { email: string };
export type Result = { ok?: string; error?: string; fields?: Record<string, string>; id?: string };

type Tx = Prisma.TransactionClient;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_ADMIN_PASSWORD = 10;

const denied = (p: Permission): Result => ({ error: `You don't have permission for this (${p}).` });

function checkPassword(password: string): string | null {
  if (password.length < MIN_ADMIN_PASSWORD) return `Use at least ${MIN_ADMIN_PASSWORD} characters.`;
  if (password.length > 200) return "Use at most 200 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Use letters and at least one number.";
  return null;
}

/** Actor's current access, read from the database (for scripts and tests; pages use src/lib/admin.ts). */
export async function loadActor(id: string): Promise<Actor | null> {
  const c = await db.customer.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, isSuperAdmin: true, adminDisabledAt: true, adminRole: { select: { permissions: true } } },
  });
  if (!c || c.role !== "ADMIN" || c.adminDisabledAt) return null;
  return { id: c.id, email: c.email, isSuperAdmin: c.isSuperAdmin, permissions: c.isSuperAdmin ? [] : cleanPermissions(c.adminRole?.permissions ?? []) };
}

async function loadStaff(tx: Tx, id: string) {
  const c = await tx.customer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isSuperAdmin: true,
      adminDisabledAt: true,
      adminRoleId: true,
      adminRole: { select: { name: true, permissions: true } },
    },
  });
  if (!c || c.role !== "ADMIN") return null;
  return { ...c, permissions: c.adminRole?.permissions ?? [] };
}

/**
 * Locks every super admin row until the transaction ends, so two admins can't each remove "another" super admin
 * at the same moment and leave none. Returns how many active super admins there are apart from `exceptId`.
 */
async function activeSuperAdminsBesides(tx: Tx, exceptId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "isSuperAdmin" = true FOR UPDATE`;
  return tx.customer.count({
    where: { role: "ADMIN", isSuperAdmin: true, adminDisabledAt: null, passwordHash: { not: null }, id: { not: exceptId } },
  });
}

const actorRef = (a: Actor) => ({ id: a.id, email: a.email });

/** Roles this actor may give to someone (never includes super admin, which is not a role). */
export async function assignableRoles(actor: AdminAccess) {
  const roles = await db.adminRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, permissions: true } });
  return roles.filter((r) => withinActorPermissions(actor, r.permissions));
}

// ---------- admin users ----------

type UserInput = { name: string; email: string; roleId: string; password?: string; active?: boolean; superAdmin?: boolean };

function validateUser(input: UserInput, withPassword: boolean) {
  const fields: Record<string, string> = {};
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  if (!name) fields.name = "Please enter a name.";
  if (!EMAIL.test(email)) fields.email = "Please enter a valid email address.";
  if (withPassword) {
    const bad = checkPassword(input.password ?? "");
    if (bad) fields.password = bad;
  }
  return { name, email, fields };
}

export async function createAdminUser(actor: Actor, input: UserInput): Promise<Result> {
  if (!can(actor, "admin_users.create")) return denied("admin_users.create");
  const { name, email, fields } = validateUser(input, true);
  const superAdmin = !!input.superAdmin;
  if (superAdmin && !actor.isSuperAdmin) return { error: "Only a super admin can create a super admin." };
  if (!input.roleId && !superAdmin) fields.roleId = "Please choose a role.";
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };

  const role = input.roleId ? await db.adminRole.findUnique({ where: { id: input.roleId } }) : null;
  if (input.roleId && !role) return { error: "That role no longer exists.", fields: { roleId: "Please choose a role." } };
  const roleDenied = role && assignRoleDenial(actor, role.permissions);
  if (roleDenied) return { error: roleDenied, fields: { roleId: roleDenied } };

  const passwordHash = await hashPassword(input.password!);
  return db.$transaction(async (tx): Promise<Result> => {
    const existing = await tx.customer.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
    // A registered account belongs to someone who chose their own password; don't turn it into staff here.
    if (existing?.passwordHash) {
      return { error: "This email already has an account. Use another email for the admin user.", fields: { email: "Already has an account." } };
    }
    const now = new Date();
    const data = {
      name,
      role: "ADMIN" as const,
      passwordHash,
      registeredAt: now,
      emailVerifiedAt: now,
      passwordChangedAt: now,
      isSuperAdmin: superAdmin,
      adminRoleId: role?.id ?? null,
      adminDisabledAt: input.active === false ? now : null,
    };
    // An earlier guest checkout with this email keeps its order history on the new account.
    const user = existing
      ? await tx.customer.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.customer.create({ data: { ...data, email }, select: { id: true } });
    await audit(
      {
        actor: actorRef(actor),
        action: "admin_user.created",
        targetType: "admin_user",
        targetId: user.id,
        targetLabel: email,
        details: { name, role: role?.name ?? null, superAdmin, active: input.active !== false, fromGuestRecord: !!existing },
      },
      tx,
    );
    if (superAdmin) {
      await audit({ actor: actorRef(actor), action: "admin_user.super_admin_granted", targetType: "admin_user", targetId: user.id, targetLabel: email }, tx);
    }
    return { ok: "Admin user created.", id: user.id };
  });
}

/** Name, email and role. Status, super admin, password and delete have their own functions. */
export async function updateAdminUser(actor: Actor, id: string, input: Omit<UserInput, "password" | "active" | "superAdmin">): Promise<Result> {
  if (!can(actor, "admin_users.edit")) return denied("admin_users.edit");
  const { name, email, fields } = validateUser(input, false);
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };

  return db.$transaction(async (tx): Promise<Result> => {
    const target = await loadStaff(tx, id);
    if (!target) return { error: "This admin user no longer exists." };
    const no = manageAdminDenial(actor, target);
    if (no) return { error: no };

    const roleId = input.roleId || null;
    if (!roleId && !target.isSuperAdmin) return { error: "Please choose a role.", fields: { roleId: "Please choose a role." } };
    const role = roleId ? await tx.adminRole.findUnique({ where: { id: roleId } }) : null;
    if (roleId && !role) return { error: "That role no longer exists.", fields: { roleId: "Please choose a role." } };
    if (roleId !== target.adminRoleId && role) {
      const roleDenied = assignRoleDenial(actor, role.permissions);
      if (roleDenied) return { error: roleDenied, fields: { roleId: roleDenied } };
    }
    if (email !== target.email) {
      const taken = await tx.customer.findUnique({ where: { email }, select: { id: true } });
      if (taken) return { error: "Another account already uses this email.", fields: { email: "Already in use." } };
    }

    await tx.customer.update({ where: { id }, data: { name, email, adminRoleId: roleId } });
    const changes: Record<string, { from: string | null; to: string | null }> = {};
    if (name !== target.name) changes.name = { from: target.name, to: name };
    if (email !== target.email) changes.email = { from: target.email, to: email };
    if (Object.keys(changes).length) {
      await audit({ actor: actorRef(actor), action: "admin_user.updated", targetType: "admin_user", targetId: id, targetLabel: email, details: changes }, tx);
    }
    if (roleId !== target.adminRoleId) {
      await audit(
        {
          actor: actorRef(actor),
          action: "admin_user.role_assigned",
          targetType: "admin_user",
          targetId: id,
          targetLabel: email,
          details: { from: target.adminRole?.name ?? null, to: role?.name ?? null },
        },
        tx,
      );
    }
    return { ok: "Admin user saved." };
  });
}

export async function setAdminActive(actor: Actor, id: string, active: boolean): Promise<Result> {
  if (!can(actor, "admin_users.disable")) return denied("admin_users.disable");
  return db.$transaction(async (tx): Promise<Result> => {
    const target = await loadStaff(tx, id);
    if (!target) return { error: "This admin user no longer exists." };
    const no = manageAdminDenial(actor, target);
    if (no) return { error: no };
    if (active === !target.adminDisabledAt) return { ok: active ? "Already enabled." : "Already disabled." };
    if (!active && target.isSuperAdmin) {
      const last = lastSuperAdminDenial(await activeSuperAdminsBesides(tx, id));
      if (last) return { error: last };
    }
    await tx.customer.update({ where: { id }, data: { adminDisabledAt: active ? null : new Date() } });
    await audit(
      { actor: actorRef(actor), action: active ? "admin_user.enabled" : "admin_user.disabled", targetType: "admin_user", targetId: id, targetLabel: target.email },
      tx,
    );
    return { ok: active ? "Admin user enabled." : "Admin user disabled and signed out." };
  });
}

export async function resetAdminPassword(actor: Actor, id: string, password: string): Promise<Result> {
  if (!can(actor, "admin_users.edit")) return denied("admin_users.edit");
  const bad = checkPassword(password);
  if (bad) return { error: bad, fields: { password: bad } };
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx): Promise<Result> => {
    const target = await loadStaff(tx, id);
    if (!target) return { error: "This admin user no longer exists." };
    const no = manageAdminDenial(actor, target);
    if (no) return { error: no };
    // passwordChangedAt ends every session of this account (src/lib/viewer.ts); open reset links stop working.
    await tx.customer.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date() } });
    await tx.authToken.deleteMany({ where: { customerId: id, purpose: "RESET_PASSWORD", usedAt: null } });
    await audit({ actor: actorRef(actor), action: "admin_user.password_reset", targetType: "admin_user", targetId: id, targetLabel: target.email }, tx);
    return { ok: "Password changed. The admin was signed out everywhere." };
  });
}

/** Protected system authority: only super admins, never on themselves, never the last one. */
export async function setSuperAdmin(actor: Actor, id: string, on: boolean): Promise<Result> {
  const no = superAdminChangeDenial(actor, id);
  if (no) return { error: no };
  return db.$transaction(async (tx): Promise<Result> => {
    const target = await loadStaff(tx, id);
    if (!target) return { error: "This admin user no longer exists." };
    if (target.isSuperAdmin === on) return { ok: on ? "Already a super admin." : "Not a super admin." };
    if (!on) {
      const last = lastSuperAdminDenial(await activeSuperAdminsBesides(tx, id));
      if (last) return { error: last };
      if (!target.adminRoleId) return { error: "Give this admin a role first; without super admin they would have no permissions." };
    }
    await tx.customer.update({ where: { id }, data: { isSuperAdmin: on } });
    await audit(
      {
        actor: actorRef(actor),
        action: on ? "admin_user.super_admin_granted" : "admin_user.super_admin_revoked",
        targetType: "admin_user",
        targetId: id,
        targetLabel: target.email,
      },
      tx,
    );
    return { ok: on ? "Now a super admin." : "Super admin removed; the admin now has their role's permissions." };
  });
}

/**
 * Removes the admin user. An account with order history (orders, quotes, reviews) is kept as a customer
 * record without a login, so that history stays linked; otherwise the account is deleted.
 */
export async function deleteAdminUser(actor: Actor, id: string): Promise<Result> {
  if (!can(actor, "admin_users.delete")) return denied("admin_users.delete");
  return db.$transaction(async (tx): Promise<Result> => {
    const target = await loadStaff(tx, id);
    if (!target) return { error: "This admin user no longer exists." };
    const no = manageAdminDenial(actor, target);
    if (no) return { error: no };
    if (target.isSuperAdmin) {
      const last = lastSuperAdminDenial(await activeSuperAdminsBesides(tx, id));
      if (last) return { error: last };
    }
    const history = await tx.customer.findUnique({
      where: { id },
      select: { _count: { select: { orders: true, quotes: true, reviews: true } } },
    });
    const keep = !!history && history._count.orders + history._count.quotes + history._count.reviews > 0;
    if (keep) {
      await tx.authToken.deleteMany({ where: { customerId: id } });
      await tx.customer.update({
        where: { id },
        data: {
          role: "CUSTOMER",
          isSuperAdmin: false,
          adminRoleId: null,
          adminDisabledAt: null,
          passwordHash: null,
          registeredAt: null,
          passwordChangedAt: new Date(),
        },
      });
    } else {
      await tx.customer.delete({ where: { id } });
    }
    await audit(
      {
        actor: actorRef(actor),
        action: "admin_user.deleted",
        targetType: "admin_user",
        targetId: id,
        targetLabel: target.email,
        details: { role: target.adminRole?.name ?? null, superAdmin: target.isSuperAdmin, keptAsCustomerRecord: keep },
      },
      tx,
    );
    return { ok: keep ? "Admin removed. Their order history is kept as a customer record without a login." : "Admin user deleted." };
  });
}

// ---------- roles ----------

type RoleInput = { name: string; description: string; permissions: string[] };

export async function saveRole(actor: Actor, id: string | null, input: RoleInput): Promise<Result> {
  const needed: Permission = id ? "roles.edit" : "roles.create";
  if (!can(actor, needed)) return denied(needed);
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60);
  const description = input.description.trim().slice(0, 300) || null;
  const permissions = cleanPermissions(input.permissions);
  if (name.length < 2) return { error: "Please check the highlighted fields.", fields: { name: "Use at least 2 characters." } };
  if (/^super[\s_-]*admin(istrator)?$/i.test(name)) {
    return { error: "Super admin is a protected system status, not a role. Choose another name.", fields: { name: "Reserved name." } };
  }

  return db.$transaction(async (tx): Promise<Result> => {
    const current = id ? await tx.adminRole.findUnique({ where: { id } }) : null;
    if (id && !current) return { error: "This role no longer exists." };
    const no = editRoleDenial(actor, current?.permissions ?? [], permissions);
    if (no) return { error: no };
    const clash = await tx.adminRole.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) return { error: "A role with this name already exists.", fields: { name: "Already in use." } };

    const role = current
      ? await tx.adminRole.update({ where: { id: current.id }, data: { name, description, permissions } })
      : await tx.adminRole.create({ data: { name, description, permissions } });
    const before = new Set(current?.permissions ?? []);
    const added = permissions.filter((p) => !before.has(p));
    const removed = [...before].filter((p) => !permissions.includes(p as Permission));
    const details: Record<string, unknown> = { added, removed };
    if (current && current.name !== name) details.name = { from: current.name, to: name };
    if (current && (current.description ?? null) !== description) details.description = { from: current.description, to: description };
    if (!current || added.length || removed.length || details.name || details.description) {
      await audit(
        {
          actor: actorRef(actor),
          action: current ? "role.updated" : "role.created",
          targetType: "role",
          targetId: role.id,
          targetLabel: name,
          details: details as Prisma.InputJsonValue,
        },
        tx,
      );
    }
    return { ok: current ? "Role saved. Its admins have the new permissions right away." : "Role created.", id: role.id };
  });
}

export async function deleteRole(actor: Actor, id: string): Promise<Result> {
  if (!can(actor, "roles.delete")) return denied("roles.delete");
  return db.$transaction(async (tx): Promise<Result> => {
    const role = await tx.adminRole.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
    if (!role) return { error: "This role no longer exists." };
    const no = editRoleDenial(actor, role.permissions, []);
    if (no) return { error: no };
    if (role._count.members) {
      return { error: `${role._count.members} admin user${role._count.members === 1 ? " has" : "s have"} this role. Give them another role first.` };
    }
    await tx.adminRole.delete({ where: { id } });
    await audit(
      { actor: actorRef(actor), action: "role.deleted", targetType: "role", targetId: id, targetLabel: role.name, details: { permissions: role.permissions } },
      tx,
    );
    return { ok: "Role deleted." };
  });
}

/**
 * For other admin screens that change a staff account's data (e.g. Customers → edit details): whether the
 * actor may change this account. Customers that aren't staff are always fine; for yourself it's fine too.
 */
export async function staffEditDenial(actor: AdminAccess, customerId: string): Promise<string | null> {
  if (customerId === actor.id) return null;
  const target = await loadStaff(db, customerId);
  return target ? manageAdminDenial(actor, target) : null;
}
