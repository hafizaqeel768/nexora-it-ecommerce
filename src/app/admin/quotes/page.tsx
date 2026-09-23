import Link from "next/link";
import { card, EmptyRow, FilterChips, row, table, td, th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { QuoteStatus } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { shortDate, statusLabel } from "@/lib/format";

type Props = { searchParams: Promise<{ status?: string }> };

// Quote requests (the prototype's a_quotes) from the home page form.
export default async function AdminQuotes({ searchParams }: Props) {
  const sp = await searchParams;
  await requireAdminPage("/admin/quotes");
  const status = (Object.values(QuoteStatus) as string[]).includes(sp.status ?? "") ? (sp.status as QuoteStatus) : null;

  const [counts, quotes] = await Promise.all([
    db.quote.groupBy({ by: ["status"], _count: { _all: true } }),
    db.quote.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { category: { select: { name: true } }, order: { select: { number: true } } },
    }),
  ]);
  const all = counts.reduce((n, c) => n + c._count._all, 0);
  const countOf = (s: QuoteStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <FilterChips
        items={[
          { label: `All (${all})`, href: "/admin/quotes", active: !status },
          ...Object.values(QuoteStatus).map((s) => ({ label: `${statusLabel(s)} (${countOf(s)})`, href: `/admin/quotes?status=${s}`, active: status === s })),
        ]}
      />
      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Quote</th>
              <th className={th}>Date</th>
              <th className={th}>Customer</th>
              <th className={th}>Category</th>
              <th className={th}>Qty</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length ? (
              quotes.map((q) => (
                <tr key={q.id} className={row}>
                  <td className={td}>
                    <Link href={`/admin/quotes/${q.id}`} className="font-bold hover:text-accent">
                      {q.number}
                    </Link>
                    {q.order && <small className="block text-12 text-muted">→ {q.order.number}</small>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{shortDate(q.createdAt)}</td>
                  <td className={td}>
                    {q.name}
                    {q.company && <small className="block text-12 text-muted">{q.company}</small>}
                  </td>
                  <td className={td}>{q.category?.name ?? "—"}</td>
                  <td className={td}>{q.quantity ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge status={q.status} />
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={6}>No quote requests.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
