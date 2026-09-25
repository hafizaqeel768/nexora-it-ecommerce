import type { Metadata } from "next";
import Link from "next/link";
import { SystemTabs } from "@/components/admin/catalog-tabs";
import { lastLogin, StaffRole, StaffStatus } from "@/components/admin/staff-badges";
import { card, EmptyRow, FilterChips, row, table, td, th } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin users" };

type Props = { searchParams: Promise<{ show?: string; done?: string }> };

// Admin users (Phase 14): staff accounts, their role or super admin status, and whether they can log in.
export default async function AdminUsers({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = await requireAdminPage("/admin/users", "admin_users.view");
  const show = sp.show === "active" || sp.show === "disabled" ? sp.show : "all";
  const [users, active, disabled] = await Promise.all([
    db.customer.findMany({
      where: { role: "ADMIN", ...(show === "active" ? { adminDisabledAt: null } : show === "disabled" ? { adminDisabledAt: { not: null } } : {}) },
      orderBy: [{ isSuperAdmin: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, isSuperAdmin: true, adminDisabledAt: true, lastLoginAt: true, createdAt: true, adminRole: { select: { name: true } } },
    }),
    db.customer.count({ where: { role: "ADMIN", adminDisabledAt: null } }),
    db.customer.count({ where: { role: "ADMIN", adminDisabledAt: { not: null } } }),
  ]);

  return (
    <>
      <SystemTabs />
      {sp.done && (
        <p role="status" className="mb-4 rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          {sp.done.slice(0, 200)}
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterChips
          items={[
            { label: `All (${active + disabled})`, href: "/admin/users", active: show === "all" },
            { label: `Active (${active})`, href: "/admin/users?show=active", active: show === "active" },
            { label: `Disabled (${disabled})`, href: "/admin/users?show=disabled", active: show === "disabled" },
          ]}
        />
        {can(admin, "admin_users.create") && (
          <Link href="/admin/users/new" className="btn text-14">
            + Add admin user
          </Link>
        )}
      </div>
      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Role</th>
              <th className={th}>Status</th>
              <th className={th}>Last login</th>
              <th className={th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.length ? (
              users.map((u) => (
                <tr key={u.id} className={row}>
                  <td className={td}>
                    <Link href={`/admin/users/${u.id}`} className="font-bold text-accent hover:underline">
                      {u.name}
                    </Link>
                    {u.id === admin.id && <span className="ml-1.5 text-12 text-muted">(you)</span>}
                  </td>
                  <td className={td}>{u.email}</td>
                  <td className={td}>
                    <StaffRole isSuperAdmin={u.isSuperAdmin} role={u.adminRole?.name ?? null} />
                  </td>
                  <td className={td}>
                    <StaffStatus disabled={!!u.adminDisabledAt} />
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{lastLogin(u.lastLoginAt)}</td>
                  <td className={`${td} whitespace-nowrap`}>{shortDate(u.createdAt)}</td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={6}>No admin users here.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
