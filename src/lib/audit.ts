// Security activity log (Phase 14): staff accounts, roles and permissions. Never pass passwords or tokens.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const AUDIT_ACTIONS = {
  "admin_user.created": "Admin created",
  "admin_user.updated": "Admin changed",
  "admin_user.role_assigned": "Role assigned",
  "admin_user.password_reset": "Password reset",
  "admin_user.disabled": "Admin disabled",
  "admin_user.enabled": "Admin enabled",
  "admin_user.deleted": "Admin deleted",
  "admin_user.super_admin_granted": "Super admin granted",
  "admin_user.super_admin_revoked": "Super admin removed",
  "role.created": "Role created",
  "role.updated": "Role changed",
  "role.deleted": "Role deleted",
  "data.imported": "Data imported",
  "data.exported": "Data exported",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export type AuditEntry = {
  actor: { id: string | null; email: string };
  action: AuditAction;
  targetType: "admin_user" | "role" | "data_transfer";
  targetId?: string | null;
  targetLabel?: string | null;
  details?: Prisma.InputJsonValue;
};

/** Pass the transaction client when the change runs in one, so the entry is saved (or rolled back) with it. */
export function audit(entry: AuditEntry, client: Prisma.TransactionClient = db) {
  return client.adminAuditLog.create({
    data: {
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel ?? null,
      details: entry.details,
    },
  });
}
