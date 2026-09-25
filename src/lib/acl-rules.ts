// Privilege-escalation rules for managing staff (Phase 14). Pure functions: the server actions and services
// call them after loading the actor and target from the database, and the tests call them directly.
//
// The rules, in short:
// - Nobody manages their own account here (role, status, super admin, password, delete).
// - Only a super admin can touch a super admin or grant/revoke super admin.
// - A normal admin can only assign, create or edit roles whose permissions they hold themselves,
//   and can only manage admins whose role is no stronger than their own permissions.
//   So "manage users" or "manage roles" never adds up to more than the actor already has.
import { cleanPermissions, type AdminAccess } from "@/lib/acl";

export type StaffTarget = { id: string; isSuperAdmin: boolean; permissions: readonly string[] };

/** Every permission in `wanted` is one the actor holds (super admins hold all). */
export function withinActorPermissions(actor: AdminAccess, wanted: readonly string[]) {
  if (actor.isSuperAdmin) return true;
  return cleanPermissions(wanted).every((p) => actor.permissions.includes(p));
}

/** Why the actor may not change this staff account, or null when they may. */
export function manageAdminDenial(actor: AdminAccess, target: StaffTarget): string | null {
  if (actor.id === target.id) return "You can't change your own admin account here. Ask another administrator.";
  if (target.isSuperAdmin && !actor.isSuperAdmin) return "Only a super admin can change a super admin.";
  if (!withinActorPermissions(actor, target.permissions)) return "This admin has permissions you don't have, so you can't change their account.";
  return null;
}

/** Why the actor may not give this role to someone, or null. */
export function assignRoleDenial(actor: AdminAccess, rolePermissions: readonly string[]): string | null {
  return withinActorPermissions(actor, rolePermissions) ? null : "You can only assign roles whose permissions you have yourself.";
}

/** Why the actor may not save a role with these permissions (or edit/delete a role that has `current`), or null. */
export function editRoleDenial(actor: AdminAccess, current: readonly string[], next: readonly string[]): string | null {
  if (!withinActorPermissions(actor, current)) return "This role has permissions you don't have, so you can't change it.";
  if (!withinActorPermissions(actor, next)) return "You can only grant permissions you have yourself.";
  return null;
}

/** Granting or revoking super admin: super admins only, never on themselves. */
export function superAdminChangeDenial(actor: AdminAccess, targetId: string): string | null {
  if (!actor.isSuperAdmin) return "Only a super admin can grant or remove super admin.";
  if (actor.id === targetId) return "You can't change your own super admin status. Ask another super admin.";
  return null;
}

/** Last-super-admin protection: `remaining` = active super admins left after the change. */
export function lastSuperAdminDenial(remaining: number): string | null {
  return remaining < 1 ? "This is the last active super admin. Make someone else a super admin first." : null;
}
