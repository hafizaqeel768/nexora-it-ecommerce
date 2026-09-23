import Link from "next/link";
import { notFound } from "next/navigation";
import { markOrderPaid, updateOrderStatus } from "@/app/actions/admin";
import { StatusForm } from "@/components/admin/status-form";
import { card, cardTitle, row, table, td, textButton, th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { OrderStatus } from "@/generated/prisma/client";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { money, shortDate, statusLabel } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

const paymentLabel = { CREDIT_CARD: "Credit card", PURCHASE_ORDER: "Purchase order", BANK_TRANSFER: "Bank transfer" } as const;
const small = "block text-12 text-muted";

// Order detail (the prototype's a_omodal): customer, ship-to, payment, items, totals, email log, status.
export default async function AdminOrder({ params }: Props) {
  const { id } = await params;
  await requireAdminPage(`/admin/orders/${id}`);
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" }, include: { product: { select: { id: true } } } },
      emails: { orderBy: { createdAt: "desc" } },
      quote: { select: { id: true, number: true } },
      customer: { select: { passwordHash: true } },
    },
  });
  if (!order) notFound();

  const n = (d: { toString(): string }) => Number(d.toString());
  const cancelled = order.status === "CANCELLED";
  const canMarkPaid = order.paymentStatus === "UNPAID" && order.paymentMethod !== "CREDIT_CARD" && !cancelled;
  const totalsRow = "flex justify-between py-1 text-14";

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/orders" className="text-accent">
          Orders
        </Link>{" "}
        / {order.number}
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-22 font-bold">Order {order.number}</h2>
        <StatusBadge status={order.status} />
        <span className="text-13 text-muted">{shortDate(order.createdAt)}</span>
        <Link href={`/order/${order.id}`} target="_blank" className="ml-auto text-13 font-bold text-accent hover:underline">
          Customer&apos;s confirmation page ↗
        </Link>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4 max-[900px]:grid-cols-1">
        <div className="grid gap-4">
          <div className={`${card} grid grid-cols-3 gap-4 max-sm:grid-cols-1`}>
            <div>
              <small className={small}>Customer</small>
              <b>{order.name}</b>
              <br />
              <a href={`mailto:${order.email}`} className="text-accent">
                {order.email}
              </a>
              {order.phone && (
                <>
                  <br />
                  {order.phone}
                </>
              )}
              <small className={`${small} mt-1`}>{order.customer?.passwordHash ? "Registered account" : "Guest checkout"}</small>
            </div>
            <div>
              <small className={small}>Ship to</small>
              {order.addressLine}
              <br />
              {[order.city, order.state, order.postalCode].filter(Boolean).join(", ")}
              <br />
              {order.country}
            </div>
            <div>
              <small className={small}>Payment</small>
              {paymentLabel[order.paymentMethod]}
              <br />
              <span className={order.paymentStatus === "PAID" ? "font-bold text-success" : "text-warning"}>
                {order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus === "REFUNDED" ? "Refunded" : "Unpaid"}
              </span>
              {canMarkPaid && (
                <form action={markOrderPaid.bind(null, order.id)} className="mt-1">
                  <button type="submit" className={textButton}>
                    Mark as paid
                  </button>
                </form>
              )}
              {order.stripeSessionId && <small className={`${small} mt-1 break-all`}>Stripe {order.stripeSessionId}</small>}
            </div>
          </div>

          <div className={card}>
            <h3 className={cardTitle}>Items</h3>
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Item</th>
                  <th className={th}>Unit</th>
                  <th className={th}>Qty</th>
                  <th className={`${th} text-right`}>Price</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className={row}>
                    <td className={td}>
                      {i.product ? (
                        <Link href={`/admin/products/${i.product.id}`} className="hover:text-accent">
                          {i.name}
                        </Link>
                      ) : (
                        i.name
                      )}
                      {i.sku && <small className="block text-12 text-muted">{i.sku}</small>}
                    </td>
                    <td className={td}>{money(i.unitPrice)}</td>
                    <td className={td}>{i.quantity}</td>
                    <td className={`${td} text-right`}>{money(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 ml-auto max-w-[280px] text-muted">
              <div className={totalsRow}>
                <span>Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {n(order.discount) > 0 && (
                <div className={totalsRow}>
                  <span>Promo{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span>−{money(order.discount)}</span>
                </div>
              )}
              <div className={totalsRow}>
                <span>Shipping</span>
                <span>{n(order.shippingFee) ? money(order.shippingFee) : "Free"}</span>
              </div>
              <div className={totalsRow}>
                <span>Tax</span>
                <span>{money(order.tax)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-16 font-extrabold text-ink">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </div>

          {(order.notes || order.quote) && (
            <div className={card}>
              <h3 className={cardTitle}>Notes</h3>
              {order.quote && (
                <p className="mb-2 text-14">
                  From quote{" "}
                  <Link href={`/admin/quotes/${order.quote.id}`} className="font-bold text-accent">
                    {order.quote.number}
                  </Link>
                </p>
              )}
              {order.notes && <p className="text-14 whitespace-pre-line text-muted">{order.notes}</p>}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className={card}>
            <h3 className={cardTitle}>Status</h3>
            {cancelled ? (
              <p className="text-14 text-muted">This order is cancelled; its stock was released. Cancelled orders are final.</p>
            ) : (
              <StatusForm
                action={updateOrderStatus.bind(null, order.id)}
                current={order.status}
                options={Object.values(OrderStatus)}
                submitLabel="Update status"
                note="Each change records a status email to the customer. Cancelling puts the items back in stock."
              />
            )}
          </div>
          <div className={card}>
            <h3 className={cardTitle}>✉️ Email notifications</h3>
            {order.emails.length ? (
              order.emails.map((e) => (
                <div key={e.id} className="flex justify-between gap-3 border-b border-[#f0f1f3] py-1.5 text-13 text-muted last:border-0">
                  <span>{shortDate(e.createdAt)}</span>
                  <span className="text-ink">{statusLabel(e.orderStatus)}</span>
                  <span>{e.sentAt ? "Sent" : e.error ? "Failed" : "Queued"}</span>
                </div>
              ))
            ) : (
              <p className="text-13 text-muted">No status emails yet.</p>
            )}
            <p className="mt-2 text-12 text-muted">Emails are recorded now and actually sent once email is set up (Phase 10).</p>
          </div>
        </div>
      </div>
    </>
  );
}
