import type { Metadata } from "next";
import Link from "next/link";
import { createAdminUser } from "@/app/actions/admin-users";
import { Field } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { RoleSelect } from "@/components/admin/role-select";
import { card, CheckField } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { assignableRoles, MIN_ADMIN_PASSWORD } from "@/lib/admin-users";

export const metadata: Metadata = { title: "Add admin user" };

// New staff account. Only roles this admin may assign are offered; super admin is a separate, protected
// switch that only super admins see.
export default async function NewAdminUser() {
  const admin = await requireAdminPage("/admin/users/new", "admin_users.create");
  const roles = await assignableRoles(admin);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/users" className="text-accent">
          Admin users
        </Link>{" "}
        / New
      </nav>
      <div className={`${card} max-w-[640px]`}>
        <ActionForm action={createAdminUser} submitLabel="Create admin user">
          <Field label="Name" name="name" required autoComplete="off" />
          <Field label="Email (used to log in)" name="email" type="email" required autoComplete="off" />
          <Field
            label={`Password (at least ${MIN_ADMIN_PASSWORD} characters, letters and a number)`}
            name="password"
            type="password"
            required
            autoComplete="new-password"
          />
          <RoleSelect roles={roles} allowNone={admin.isSuperAdmin} />
          <CheckField name="active" label="Active" hint="Unticked: the account exists but can't log in yet." defaultChecked />
          {admin.isSuperAdmin && (
            <CheckField
              name="superAdmin"
              label="Super admin (protected)"
              hint="Every permission, including managing other super admins. Only super admins can grant this."
            />
          )}
        </ActionForm>
      </div>
    </>
  );
}
