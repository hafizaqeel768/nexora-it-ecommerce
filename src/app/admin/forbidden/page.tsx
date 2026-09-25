import type { Metadata } from "next";
import Link from "next/link";
import { card } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { sectionLinks } from "@/lib/admin-sections";

export const metadata: Metadata = { title: "No permission" };

// Where staff land when they open an admin page their role doesn't allow (Phase 14).
export default async function AdminForbidden() {
  const admin = await requireAdminPage("/admin");
  const home = Object.values(sectionLinks(admin))[0];
  return (
    <div className={`${card} max-w-[560px]`}>
      <h2 className="text-18 font-bold">You don&apos;t have permission to open this page</h2>
      <p className="mt-2 text-14 text-muted">
        {admin.roleName ? (
          <>
            Your role, <b className="text-ink">{admin.roleName}</b>, doesn&apos;t include it.
          </>
        ) : (
          "Your account has no role yet, so it can't open any admin pages."
        )}{" "}
        If you need access, ask an administrator to change your role.
      </p>
      {home && (
        <Link href={home} className="btn mt-4 text-14">
          Go to a page you can open
        </Link>
      )}
    </div>
  );
}
