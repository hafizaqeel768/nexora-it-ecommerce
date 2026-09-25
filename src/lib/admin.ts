// Admin access (server-only). Every admin page, server action and export route checks this itself, with the
// permission it needs (Phase 14 ACL, src/lib/acl.ts). Hiding buttons in the UI is only a convenience.
import { redirect } from "next/navigation";
import { can, canAny, cleanPermissions, type Permission } from "@/lib/acl";
import { getViewer, type Viewer } from "@/lib/viewer";

export type Admin = Viewer & { isSuperAdmin: boolean; permissions: Permission[]; roleName: string | null };

/** Staff account with its effective permissions, or null. A staff account without a role has no permissions. */
function toAdmin(viewer: Viewer | null): Admin | null {
  if (viewer?.role !== "ADMIN") return null;
  return {
    ...viewer,
    permissions: viewer.isSuperAdmin ? [] : cleanPermissions(viewer.adminRole?.permissions ?? []),
    roleName: viewer.isSuperAdmin ? "Super Admin" : (viewer.adminRole?.name ?? null),
  };
}

/**
 * For pages: signed out → login (back to the page afterwards); not staff → "no access" page;
 * staff without the permission (any of them, when several are given) → "no permission" page.
 */
export async function requireAdminPage(path: string, permission?: Permission | readonly Permission[]) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  const admin = toAdmin(viewer);
  if (!admin) redirect("/no-access");
  if (permission && !canAny(admin, typeof permission === "string" ? [permission] : permission)) redirect("/admin/forbidden");
  return admin;
}

/** For server actions and route handlers: null unless the caller is staff (and has the permission, if given). */
export async function getAdmin(permission?: Permission) {
  const admin = toAdmin(await getViewer());
  if (!admin || (permission && !can(admin, permission))) return null;
  return admin;
}

export class NotAdminError extends Error {
  constructor(message = "Admin access required.") {
    super(message);
  }
}

/** Throws unless the caller is staff with every permission given. */
export async function assertAdmin(...permissions: Permission[]) {
  const admin = toAdmin(await getViewer());
  if (!admin) throw new NotAdminError();
  const missing = permissions.find((p) => !can(admin, p));
  if (missing) throw new NotAdminError(`You don't have permission for this (${missing}).`);
  return admin;
}
