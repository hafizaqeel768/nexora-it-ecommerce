import type { Metadata } from "next";
import Link from "next/link";
import { SystemTabs } from "@/components/admin/catalog-tabs";
import { pill } from "@/components/admin/staff-badges";
import { card, EmptyRow, row, table, td, th } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Roles" };

type Props = { searchParams: Promise<{ done?: string }> };

// Roles (Phase 14): named sets of permissions given to admin users. Super admin is not a role.
export default async function AdminRoles({ searchParams }: Props) {
  const { done } = await searchParams;
  const admin = await requireAdminPage("/admin/roles", "roles.view");
  const [roles, supers] = await Promise.all([
    db.adminRole.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { members: true } } } }),
    db.customer.count({ where: { role: "ADMIN", isSuperAdmin: true } }),
  ]);

  return (
    <>
      <SystemTabs />
      {done && (
        <p role="status" className="mb-4 rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          {done.slice(0, 200)}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-13 text-muted">
          A role is a set of permissions. Changes apply to its admins immediately. <b className="text-ink">Super admin</b> ({supers}) is a protected status
          set on the admin user, not a role, so it can&apos;t be granted here.
        </p>
        {can(admin, "roles.create") && (
          <Link href="/admin/roles/new" className="btn text-14">
            + Add role
          </Link>
        )}
      </div>
      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Role</th>
              <th className={th}>Description</th>
              <th className={th}>Permissions</th>
              <th className={th}>Admins</th>
            </tr>
          </thead>
          <tbody>
            {roles.length ? (
              roles.map((r) => (
                <tr key={r.id} className={row}>
                  <td className={td}>
                    <Link href={`/admin/roles/${r.id}`} className="font-bold text-accent hover:underline">
                      {r.name}
                    </Link>
                    {admin.adminRole?.id === r.id && !admin.isSuperAdmin && <span className="ml-1.5 text-12 text-muted">(your role)</span>}
                  </td>
                  <td className={`${td} text-muted`}>{r.description ?? "—"}</td>
                  <td className={td}>
                    <span className={`${pill} bg-[#f3f4f6] text-ink`}>{r.permissions.length}</span>
                  </td>
                  <td className={td}>{r._count.members}</td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={4}>No roles yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
