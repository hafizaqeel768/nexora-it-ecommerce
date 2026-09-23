import { OrderTable } from "@/components/admin/order-table";
import { Pager, pageParam } from "@/components/admin/pager";
import { card, ExportLink, FilterChips } from "@/components/admin/ui";
import { OrderStatus } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { statusLabel } from "@/lib/format";

const PER_PAGE = 50;

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

// Orders (the prototype's a_orders): status chips with counts, table, CSV export.
export default async function AdminOrders({ searchParams }: Props) {
  const sp = await searchParams;
  await requireAdminPage("/admin/orders");
  const status = (Object.values(OrderStatus) as string[]).includes(sp.status ?? "") ? (sp.status as OrderStatus) : null;
  const page = pageParam(sp.page);
  const where = status ? { status } : {};

  const [counts, total, orders] = await Promise.all([
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const countOf = (s: OrderStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const href = (s: OrderStatus | null, p = 1) => `/admin/orders?${new URLSearchParams({ ...(s && { status: s }), ...(p > 1 && { page: String(p) }) })}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterChips
          items={[
            { label: `All (${all})`, href: href(null), active: !status },
            ...Object.values(OrderStatus).map((s) => ({ label: `${statusLabel(s)} (${countOf(s)})`, href: href(s), active: status === s })),
          ]}
        />
        <ExportLink href={`/admin/export/orders${status ? `?status=${status}` : ""}`} />
      </div>
      <div className={card}>
        <OrderTable orders={orders} />
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} href={(p) => href(status, p)} />
    </>
  );
}
