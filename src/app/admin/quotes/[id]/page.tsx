import Link from "next/link";
import { notFound } from "next/navigation";
import { convertQuoteToOrder, updateQuoteStatus } from "@/app/actions/admin";
import { StatusForm } from "@/components/admin/status-form";
import { card, cardTitle } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { QuoteStatus } from "@/generated/prisma/client";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

const small = "block text-12 text-muted";

// Quote detail (the prototype's a_qmodal): contact, request, message, status, convert to order.
export default async function AdminQuote({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdminPage(`/admin/quotes/${id}`, "quotes.view");
  const canEdit = can(admin, "quotes.edit");
  const q = await db.quote.findUnique({
    where: { id },
    include: { category: { select: { name: true } }, order: { select: { id: true, number: true } } },
  });
  if (!q) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/quotes" className="text-accent">
          Quotes
        </Link>{" "}
        / {q.number}
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-22 font-bold">Quote {q.number}</h2>
        <StatusBadge status={q.status} />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4 max-[900px]:grid-cols-1">
        <div className={`${card} grid grid-cols-2 gap-4 max-sm:grid-cols-1`}>
          <div>
            <small className={small}>Contact</small>
            <b>{q.name}</b>
            {q.company && (
              <>
                <br />
                {q.company}
              </>
            )}
            <br />
            <a href={`mailto:${q.email}`} className="text-accent">
              {q.email}
            </a>
            {q.phone && (
              <>
                <br />
                {q.phone}
              </>
            )}
          </div>
          <div>
            <small className={small}>Request</small>
            {q.category?.name ?? "General"} · qty {q.quantity ?? "—"}
            <small className={`${small} mt-2`}>Received</small>
            {shortDate(q.createdAt)}
          </div>
          <div className="col-span-full">
            <small className={small}>Message</small>
            <p className="whitespace-pre-line">{q.message}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className={card}>
            <h3 className={cardTitle}>Order</h3>
            {q.order ? (
              <p className="text-14">
                Converted to{" "}
                <Link href={`/admin/orders/${q.order.id}`} className="font-bold text-accent">
                  {q.order.number}
                </Link>
                .
              </p>
            ) : !(canEdit && can(admin, "orders.edit")) ? (
              <p className="text-14 text-muted">Not converted to an order yet.</p>
            ) : (
              <form action={convertQuoteToOrder.bind(null, q.id)} className="grid gap-2">
                <button type="submit" className="btn cursor-pointer justify-self-start border-0 bg-ink text-14">
                  ⇄ Convert to order
                </button>
                <p className="text-12 text-muted">
                  Creates a pending purchase-order order with a $0 placeholder line to price with the customer, and marks the quote as won.
                </p>
              </form>
            )}
          </div>
          <div className={card}>
            <h3 className={cardTitle}>Status</h3>
            {canEdit ? (
              <StatusForm action={updateQuoteStatus.bind(null, q.id)} current={q.status} options={Object.values(QuoteStatus)} submitLabel="Update" />
            ) : (
              <p className="text-14">
                <StatusBadge status={q.status} />
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
