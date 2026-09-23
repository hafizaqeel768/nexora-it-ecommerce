import Link from "next/link";
import { OrderTable } from "@/components/admin/order-table";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { card, cardTitle, Kpi } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getStoreRules } from "@/lib/settings";

const DAYS = 14;
const counted = { status: { not: "CANCELLED" as const } };

// Dashboard (the prototype's a_dash): KPIs, revenue for the last 14 days, top products, recent orders, low stock.
// Revenue counts every order that isn't cancelled, like the prototype.
export default async function AdminDashboard() {
  await requireAdminPage("/admin");
  const { lowStockAt } = await getStoreRules();

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (DAYS - 1));

  const [revenue, orderCount, pendingCount, buyers, quoteCount, newQuotes, recentDays, top, recent, lowWhere] = await Promise.all([
    db.order.aggregate({ where: counted, _sum: { total: true }, _count: true }),
    db.order.count(),
    db.order.count({ where: { status: "PENDING" } }),
    db.order.groupBy({ by: ["email"] }),
    db.quote.count(),
    db.quote.count({ where: { status: "NEW" } }),
    db.order.findMany({ where: { ...counted, createdAt: { gte: since } }, select: { createdAt: true, total: true } }),
    db.orderItem.groupBy({
      by: ["name"],
      where: { order: counted },
      _sum: { lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    Promise.resolve({ status: "ACTIVE" as const, stock: { not: null, lte: lowStockAt } }),
  ]);
  const [lowCount, low] = await Promise.all([
    db.product.count({ where: lowWhere }),
    db.product.findMany({ where: lowWhere, orderBy: [{ stock: "asc" }, { name: "asc" }], take: 6, select: { id: true, name: true, stock: true } }),
  ]);

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const value = recentDays.filter((o) => o.createdAt >= d && o.createdAt < next).reduce((s, o) => s + Number(o.total), 0);
    return {
      key: d.toISOString(),
      day: String(d.getDate()),
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      value: Math.round(value * 100) / 100,
    };
  });

  const grid = "mb-4 grid grid-cols-[1.6fr_1fr] gap-4 max-[900px]:grid-cols-1";
  const listRow = "flex justify-between gap-2.5 border-b border-[#f0f1f3] py-2.5 text-ui last:border-0";

  return (
    <>
      <div className="mb-4 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        <Kpi label="Revenue" value={money(revenue._sum.total ?? 0)} note={`${revenue._count} orders, excl. cancelled`} />
        <Kpi label="Orders" value={orderCount} note={`${pendingCount} pending`} />
        <Kpi label="Customers" value={buyers.length} note="unique buyers" />
        <Kpi label="Quote requests" value={quoteCount} note={`${newQuotes} new`} />
      </div>

      <div className={grid}>
        <div className={card}>
          <h3 className={cardTitle}>Revenue · last {DAYS} days</h3>
          <RevenueChart days={days} />
        </div>
        <div className={card}>
          <h3 className={cardTitle}>Top products</h3>
          {top.length ? (
            top.map((t) => (
              <div key={t.name} className={listRow}>
                <span className="min-w-0 truncate">{t.name}</span>
                <b className="flex-none">{money(t._sum.lineTotal ?? 0)}</b>
              </div>
            ))
          ) : (
            <p className="text-muted">No sales yet.</p>
          )}
        </div>
      </div>

      <div className={grid}>
        <div className={card}>
          <h3 className={cardTitle}>
            Recent orders{" "}
            <Link href="/admin/orders" className="ml-2 text-13 font-bold text-accent hover:underline">
              View all →
            </Link>
          </h3>
          <OrderTable orders={recent} />
        </div>
        <div className={card}>
          <h3 className={cardTitle}>Low stock ({lowCount})</h3>
          {low.length ? (
            low.map((p) => (
              <div key={p.id} className={listRow}>
                <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate hover:text-accent">
                  {p.name}
                </Link>
                <b className="flex-none text-[#dc2626]">{p.stock} left</b>
              </div>
            ))
          ) : (
            <p className="text-muted">All products well stocked.</p>
          )}
          <p className="mt-2 text-12 text-muted">Alert at {lowStockAt} units or fewer (Settings).</p>
        </div>
      </div>
    </>
  );
}
