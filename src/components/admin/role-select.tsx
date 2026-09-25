import { select } from "@/components/admin/ui";

// Role picker for admin users (Phase 14). `roles` are only those the signed-in admin may assign;
// super admin is never one of them (it's a protected status with its own switch).
export function RoleSelect({
  roles,
  current,
  allowNone = false,
}: {
  roles: { id: string; name: string; permissions: string[] }[];
  current?: string | null;
  allowNone?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-13 text-muted">
      <span>Role *</span>
      <select name="roleId" defaultValue={current ?? ""} className={`${select} w-full py-3`}>
        <option value="">{allowNone ? "No role (only for super admins)" : "Choose a role…"}</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"})
          </option>
        ))}
      </select>
      {roles.length === 0 && <span>There are no roles you can assign. Roles can only contain permissions you have yourself.</span>}
    </label>
  );
}
