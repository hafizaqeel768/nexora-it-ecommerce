import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/account";
import { AdminNav, AdminTitle } from "@/components/admin/admin-nav";
import { StoreLogo } from "@/components/store-logo";
import { requireAdminPage } from "@/lib/admin";
import { sectionLinks } from "@/lib/admin-sections";
import { getConfig } from "@/lib/config";

export const metadata: Metadata = { title: { template: "%s · Admin", default: "Admin" }, robots: { index: false } };

// Admin shell (the prototype's a_layout): dark sidebar, top bar with the admin's email, content.
// Each admin page and action checks its own permission too; this only guards the shell and shows the
// sidebar sections the admin may open.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage("/admin");
  const store = await getConfig("store");

  return (
    <div className="grid min-h-screen grid-cols-[230px_1fr] bg-bg max-[900px]:grid-cols-1">
      <aside className="sticky top-0 flex h-screen flex-col bg-[#0f1115] px-3.5 py-5 text-[#c9ccd3] max-[900px]:static max-[900px]:h-auto max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:items-center max-[900px]:p-3">
        <Link href="/admin" className="px-2.5 pb-[22px] text-22 font-black tracking-[-.8px] text-white max-[900px]:pb-0">
          <StoreLogo store={store} className="text-22 tracking-[-.8px]" imageClassName="h-9 w-auto brightness-0 invert" />
          <small className="mt-0.5 block text-11 font-semibold tracking-[.14em] text-[#8b909a]">ADMIN PANEL</small>
        </Link>
        <AdminNav links={sectionLinks(admin)} />
        <div className="mt-auto grid gap-2.5 p-2.5 text-13 text-[#9aa0aa] max-[900px]:mt-0 max-[900px]:ml-auto max-[900px]:flex max-[900px]:gap-4">
          <Link href="/" className="hover:text-white">
            ← View store
          </Link>
          <form action={logout}>
            <button type="submit" className="cursor-pointer hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white px-7 py-3.5 max-[900px]:static max-[900px]:px-4 max-[900px]:py-3">
          <AdminTitle />
          <div className="flex min-w-0 items-center gap-2.5 text-13 text-muted">
            <i className="grid size-[34px] flex-none place-items-center rounded-full bg-accent font-bold text-white not-italic">
              {admin.name.charAt(0).toUpperCase()}
            </i>
            <span className="grid min-w-0 leading-tight max-sm:hidden">
              <span className="truncate">{admin.email}</span>
              <small className={`text-11 font-semibold ${admin.isSuperAdmin ? "text-accent" : "text-muted"}`}>{admin.roleName ?? "No role assigned"}</small>
            </span>
          </div>
        </div>
        <div className="px-7 pt-6 pb-[60px] max-[900px]:p-4">{children}</div>
      </div>
    </div>
  );
}
