import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAdminUser, resetAdminPassword, setAdminActive, setSuperAdmin, updateAdminUser } from "@/app/actions/admin-users";
import { Field } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { AuditList } from "@/components/admin/audit-list";
import { RoleSelect } from "@/components/admin/role-select";
import { lastLogin, StaffRole, StaffStatus } from "@/components/admin/staff-badges";
import { StaffActionButton } from "@/components/admin/staff-forms";
import { card, cardTitle } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { manageAdminDenial, superAdminChangeDenial } from "@/lib/acl-rules";
import { requireAdminPage } from "@/lib/admin";
import { assignableRoles, MIN_ADMIN_PASSWORD } from "@/lib/admin-users";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin user" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

// One staff account: details and role, status, password, super admin (super admins only), delete, history.
// What can be changed follows the same rules the server applies (src/lib/acl-rules.ts).
export default async function AdminUser({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const admin = await requireAdminPage(`/admin/users/${id}`, "admin_users.view");
  const u = await db.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      adminDisabledAt: true,
      adminRoleId: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      adminRole: { select: { name: true, permissions: true } },
    },
  });
  if (!u || u.role !== "ADMIN") notFound();

  const self = u.id === admin.id;
  const denial = manageAdminDenial(admin, { id: u.id, isSuperAdmin: u.isSuperAdmin, permissions: u.adminRole?.permissions ?? [] });
  const [roles, history] = await Promise.all([
    assignableRoles(admin),
    can(admin, "audit_log.view")
      ? db.adminAuditLog.findMany({ where: { targetType: "admin_user", targetId: u.id }, orderBy: { createdAt: "desc" }, take: 15 })
      : Promise.resolve(null),
  ]);
  const mayEdit = !denial && can(admin, "admin_users.edit");
  const mayDisable = !denial && can(admin, "admin_users.disable");
  const mayDelete = !denial && can(admin, "admin_users.delete");
  const maySuper = !superAdminChangeDenial(admin, u.id);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/users" className="text-accent">
          Admin users
        </Link>{" "}
        / {u.name}
      </nav>
      {created && (
        <p role="status" className="mb-4 max-w-[900px] rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          Admin user created. They can log in at /login with this email and the password you set.
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h2 className="text-22 font-bold">{u.name}</h2>
        <span className="text-14 text-muted">{u.email}</span>
        <StaffRole isSuperAdmin={u.isSuperAdmin} role={u.adminRole?.name ?? null} />
        <StaffStatus disabled={!!u.adminDisabledAt} />
        {self && <span className="text-12 text-muted">(you)</span>}
      </div>
      <p className="mb-4 text-13 text-muted">
        Last login: {lastLogin(u.lastLoginAt)} · created {shortDate(u.createdAt)} · updated {shortDate(u.updatedAt)}
      </p>
      {denial && (
        <p className="mb-4 max-w-[900px] rounded-12 border border-line bg-[#f4f6f9] px-4 py-3 text-14">
          {denial}
          {self && (
            <>
              {" "}
              To change your name or password, use{" "}
              <Link href="/account" className="font-bold text-accent">
                My account
              </Link>
              .
            </>
          )}
        </p>
      )}

      <div className="grid max-w-[1100px] grid-cols-[1.4fr_1fr] items-start gap-4 max-[1000px]:grid-cols-1">
        <div className="grid gap-4">
          <div className={card}>
            <h3 className={cardTitle}>Details & role</h3>
            <ActionForm action={updateAdminUser.bind(null, u.id)} submitLabel="Save" readOnly={!mayEdit}>
              <Field label="Name" name="name" defaultValue={u.name} required />
              <Field label="Email (used to log in)" name="email" type="email" defaultValue={u.email} required />
              <RoleSelect roles={roles} current={u.adminRoleId} allowNone={u.isSuperAdmin} />
              {u.isSuperAdmin && <p className="text-12 text-muted">As a super admin this account has every permission; the role applies if super admin is removed.</p>}
            </ActionForm>
          </div>

          {mayEdit && (
            <div className={card}>
              <h3 className={cardTitle}>Reset password</h3>
              <ActionForm action={resetAdminPassword.bind(null, u.id)} submitLabel="Set new password" resetOnSuccess>
                <Field label={`New password (at least ${MIN_ADMIN_PASSWORD} characters, letters and a number)`} name="password" type="password" autoComplete="new-password" />
                <Field label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" />
                <p className="text-12 text-muted">The admin is signed out on every device and has to log in with the new password.</p>
              </ActionForm>
            </div>
          )}

          {history && (
            <div className={card}>
              <h3 className={cardTitle}>History</h3>
              <AuditList entries={history} />
            </div>
          )}
        </div>

        <div className="grid gap-4">
          {mayDisable && (
            <div className={card}>
              <h3 className={cardTitle}>Status</h3>
              <p className="mb-3 text-14 text-muted">
                {u.adminDisabledAt ? `Disabled since ${shortDate(u.adminDisabledAt)}. The account can't log in.` : "Active: the account can log in."}
              </p>
              {u.adminDisabledAt ? (
                <StaffActionButton action={setAdminActive.bind(null, u.id, true)} label="Enable account" />
              ) : (
                <StaffActionButton
                  action={setAdminActive.bind(null, u.id, false)}
                  label="Disable account"
                  confirmText={`Disable ${u.email}? They are signed out at once and can't log in until enabled again.`}
                />
              )}
            </div>
          )}

          {maySuper && (
            <div className={`${card} border-[#f3c1c6]`}>
              <h3 className={cardTitle}>Super admin (protected)</h3>
              <p className="mb-3 text-13 text-muted">
                Super admins have every permission and are the only ones who can manage other super admins. It is not a role, so it can&apos;t be granted
                through roles or by admins who manage users. There must always be at least one active super admin.
              </p>
              {u.isSuperAdmin ? (
                <StaffActionButton
                  action={setSuperAdmin.bind(null, u.id, false)}
                  label="Remove super admin"
                  confirmText={`Remove super admin from ${u.email}? They keep only their role's permissions.`}
                  danger
                />
              ) : (
                <StaffActionButton
                  action={setSuperAdmin.bind(null, u.id, true)}
                  label="Make super admin"
                  confirmText={`Make ${u.email} a super admin? They get every permission, including managing you.`}
                  danger
                />
              )}
            </div>
          )}

          {mayDelete && (
            <div className={card}>
              <h3 className={cardTitle}>Delete admin user</h3>
              <p className="mb-3 text-13 text-muted">
                Removes staff access. If the account has orders, quotes or reviews, it stays as a customer record without a login so that history is kept.
              </p>
              <StaffActionButton
                action={deleteAdminUser.bind(null, u.id)}
                label="Delete admin user"
                confirmText={`Delete the admin user ${u.email}? This can't be undone.`}
                danger
              />
            </div>
          )}

          {can(admin, "customers.view") && (
            <p className="text-13">
              <Link href={`/admin/customers/${u.id}`} className="font-bold text-accent">
                Customer record (orders, wishlist) →
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
