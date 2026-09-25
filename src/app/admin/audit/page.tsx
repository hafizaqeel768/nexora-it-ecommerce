import type { Metadata } from "next";
import { AuditList } from "@/components/admin/audit-list";
import { SystemTabs } from "@/components/admin/catalog-tabs";
import { Pager, pageParam } from "@/components/admin/pager";
import { card, FilterChips } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Activity log" };

const PER_PAGE = 50;

type Props = { searchParams: Promise<{ type?: string; page?: string }> };

// Security activity log (Phase 14): changes to admin users, roles and permissions. Read-only.
export default async function AdminAudit({ searchParams }: Props) {
  const sp = await searchParams;
  await requireAdminPage("/admin/audit", "audit_log.view");
  const type = sp.type === "admin_user" || sp.type === "role" ? sp.type : null;
  const page = pageParam(sp.page);
  const where = type ? { targetType: type } : {};
  const [total, entries] = await Promise.all([
    db.adminAuditLog.count({ where }),
    db.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const href = (t: string | null, p = 1) => `/admin/audit?${new URLSearchParams({ ...(t ? { type: t } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <SystemTabs />
      <FilterChips
        items={[
          { label: "Everything", href: href(null), active: !type },
          { label: "Admin users", href: href("admin_user"), active: type === "admin_user" },
          { label: "Roles & permissions", href: href("role"), active: type === "role" },
        ]}
      />
      <div className={`${card} max-w-[900px]`}>
        <AuditList entries={entries} showTarget />
        <Pager page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} href={(p) => href(type, p)} />
      </div>
    </>
  );
}
