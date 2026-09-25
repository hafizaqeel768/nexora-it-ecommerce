import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRole, saveRole } from "@/app/actions/admin-users";
import { Field } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { AuditList } from "@/components/admin/audit-list";
import { StaffRole, StaffStatus } from "@/components/admin/staff-badges";
import { PermissionPicker, StaffActionButton } from "@/components/admin/staff-forms";
import { card, cardTitle } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { editRoleDenial } from "@/lib/acl-rules";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Role" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

// One role: name, description, permissions, its admins, history.
export default async function AdminRolePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const admin = await requireAdminPage(`/admin/roles/${id}`, "roles.view");
  const role = await db.adminRole.findUnique({
    where: { id },
    include: { members: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isSuperAdmin: true, adminDisabledAt: true } } },
  });
  if (!role) notFound();
  const history = can(admin, "audit_log.view")
    ? await db.adminAuditLog.findMany({ where: { targetType: "role", targetId: role.id }, orderBy: { createdAt: "desc" }, take: 15 })
    : null;

  const denial = editRoleDenial(admin, role.permissions, []);
  const mayEdit = !denial && can(admin, "roles.edit");
  const mayDelete = !denial && can(admin, "roles.delete");

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/roles" className="text-accent">
          Roles
        </Link>{" "}
        / {role.name}
      </nav>
      {created && (
        <p role="status" className="mb-4 max-w-[1000px] rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          Role created. Assign it to admins in Admin users.
        </p>
      )}
      {denial && <p className="mb-4 max-w-[1000px] rounded-12 border border-line bg-[#f4f6f9] px-4 py-3 text-14">{denial}</p>}

      <div className="grid max-w-[1000px] gap-4">
        <div className={card}>
          <ActionForm action={saveRole} submitLabel="Save role" readOnly={!mayEdit}>
            <input type="hidden" name="id" value={role.id} />
            <div className="grid max-w-[640px] gap-3.5">
              <Field label="Role name" name="name" defaultValue={role.name} required />
              <Field label="Description" name="description" defaultValue={role.description ?? ""} />
            </div>
            <PermissionPicker selected={role.permissions} grantable={admin.isSuperAdmin ? "all" : admin.permissions} readOnly={!mayEdit} />
          </ActionForm>
        </div>

        <div className={card}>
          <h3 className={cardTitle}>Admins with this role ({role.members.length})</h3>
          {role.members.length ? (
            <ul className="grid gap-2 text-14">
              {role.members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2.5">
                  {can(admin, "admin_users.view") ? (
                    <Link href={`/admin/users/${m.id}`} className="font-bold text-accent">
                      {m.name}
                    </Link>
                  ) : (
                    <b>{m.name}</b>
                  )}
                  <span className="text-muted">{m.email}</span>
                  {m.isSuperAdmin && <StaffRole isSuperAdmin role={null} />}
                  <StaffStatus disabled={!!m.adminDisabledAt} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-13 text-muted">Nobody has this role yet.</p>
          )}
        </div>

        {mayDelete && (
          <div className={card}>
            <h3 className={cardTitle}>Delete role</h3>
            {role.members.length ? (
              <p className="text-13 text-muted">Give its admins another role first; a role in use can&apos;t be deleted.</p>
            ) : (
              <StaffActionButton action={deleteRole.bind(null, role.id)} label="Delete role" confirmText={`Delete the role “${role.name}”?`} danger />
            )}
          </div>
        )}

        {history && (
          <div className={card}>
            <h3 className={cardTitle}>History</h3>
            <AuditList entries={history} />
          </div>
        )}
      </div>
    </>
  );
}
