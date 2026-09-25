import type { Metadata } from "next";
import Link from "next/link";
import { saveRole } from "@/app/actions/admin-users";
import { Field } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { PermissionPicker } from "@/components/admin/staff-forms";
import { card } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Add role" };

// New role. Admins who aren't super admins can only tick permissions they have themselves.
export default async function NewRole() {
  const admin = await requireAdminPage("/admin/roles/new", "roles.create");
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/roles" className="text-accent">
          Roles
        </Link>{" "}
        / New
      </nav>
      <div className={`${card} max-w-[1000px]`}>
        <ActionForm action={saveRole} submitLabel="Create role">
          <div className="grid max-w-[640px] gap-3.5">
            <Field label="Role name" name="name" required placeholder="e.g. Product Editor" />
            <Field label="Description" name="description" placeholder="What this role is for" />
          </div>
          <PermissionPicker selected={[]} grantable={admin.isSuperAdmin ? "all" : admin.permissions} />
        </ActionForm>
      </div>
    </>
  );
}
