import Link from "next/link";
import { notFound } from "next/navigation";
import { markOrderPaid, retryOrderEmail, updateOrderStatus } from "@/app/actions/admin";
import { addOrderNote, refundOrder, saveTracking, updateOrderAddress } from "@/app/actions/orders";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { OrderEditor } from "@/components/admin/order-editor";
import { StatusForm } from "@/components/admin/status-form";
import { card, cardTitle, CheckField, row, select, table, td, textButton, th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { OrderStatus } from "@/generated/prisma/client";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { COUNTRIES } from "@/lib/countries";
import { db } from "@/lib/db";
import { money, paymentStatusLabel, shortDate, statusLabel } from "@/lib/format";
import { CARRIERS, trackingInfo } from "@/lib/tracking";

type Props = { params: Promise<{ id: string }> };

const paymentLabel = { CREDIT_CARD: "Credit card", PURCHASE_ORDER: "Purchase order", BANK_TRANSFER: "Bank transfer" } as const;
const small = "block text-12 text-muted";
const label = "grid gap-1.5 text-13 text-muted";
const time = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function TrackingFields({ carrier, number }: { carrier?: string | null; number?: string | null }) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-2 max-sm:grid-cols-1">
      <select name="trackingCarrier" defaultValue={carrier ?? "ups"} aria-label="Carrier" className={`${select} w-full`}>
        {CARRIERS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input name="trackingNumber" defaultValue={number ?? ""} placeholder="Tracking number" aria-label="Tracking number" className={`${fieldClass} py-2.5`} />
    </div>
  );
}

// Order detail (the prototype's a_omodal) + Phase 13 operations: edit items/address, tracking, refunds,
// invoice/packing slip, internal notes and the activity timeline.
export default async function AdminOrder({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdminPage(`/admin/orders/${id}`, "orders.view");
  // What this admin's role may change here (the actions check again).
  const canEdit = can(admin, "orders.edit");
  const canRefund = can(admin, "orders.refund");
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { id: "asc" }, include: { product: { select: { id: true } } } },
      emails: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" } },
      activity: { orderBy: { createdAt: "desc" } },
      quote: { select: { id: true, number: true } },
      customer: { select: { id: true, passwordHash: true } },
    },
  });
  if (!order) notFound();

  const n = (d: { toString(): string }) => Number(d.toString());
  const cancelled = order.status === "CANCELLED";
  const canMarkPaid = canEdit && order.paymentStatus === "UNPAID" && order.paymentMethod !== "CREDIT_CARD" && !cancelled;
  const editable = canEdit && ["PENDING", "PROCESSING"].includes(order.status) && order.paymentStatus === "UNPAID" && order.paymentMethod !== "CREDIT_CARD";
  const addressEditable = canEdit && ["PENDING", "PROCESSING"].includes(order.status);
  const refundable = order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
  const remaining = Math.round((n(order.total) - n(order.refundedTotal)) * 100) / 100;
  const track = trackingInfo(order.trackingCarrier, order.trackingNumber);
  const totalsRow = "flex justify-between py-1 text-14";
  // Rate applied to the order, and whether it included shipping (older orders: inferred from the amounts).
  const base = n(order.subtotal) - n(order.discount);
  const taxRate = order.taxRate != null ? n(order.taxRate) : base ? Math.round((n(order.tax) / base) * 1000) / 10 : 0;
  const taxShipping = Math.abs(((base + n(order.shippingFee)) * taxRate) / 100 - n(order.tax)) < Math.abs((base * taxRate) / 100 - n(order.tax));

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
        <span className="ml-auto flex flex-wrap gap-4 text-13 font-bold">
          <Link href={`/print/invoice/${order.id}`} target="_blank" className="text-accent hover:underline">
            Invoice ↗
          </Link>
          <Link href={`/print/packing-slip/${order.id}`} target="_blank" className="text-accent hover:underline">
            Packing slip ↗
          </Link>
          <Link href={`/order/${order.id}`} target="_blank" className="text-muted hover:text-accent">
            Customer&apos;s page ↗
          </Link>
        </span>
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4 max-[1100px]:grid-cols-1">
        <div className="grid gap-4">
          <div className={`${card} grid grid-cols-3 gap-4 max-sm:grid-cols-1`}>
            <div>
              <small className={small}>Customer</small>
              {order.customer ? (
                <Link href={`/admin/customers/${order.customer.id}`} className="font-bold hover:text-accent">
                  {order.name}
                </Link>
              ) : (
                <b>{order.name}</b>
              )}
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
              {order.shippingMethod && <small className={`${small} mt-1`}>Shipping: {order.shippingMethod}</small>}
            </div>
            <div>
              <small className={small}>Payment</small>
              {paymentLabel[order.paymentMethod]}
              <br />
              <span className={order.paymentStatus === "PAID" ? "font-bold text-success" : "text-warning"}>{paymentStatusLabel(order.paymentStatus)}</span>
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
            <div className="mt-3 ml-auto max-w-[300px] text-muted">
              <div className={totalsRow}>
                <span>Subtotal</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {n(order.discount) > 0 && (
                <div className={totalsRow}>
                  <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                  <span>−{money(order.discount)}</span>
                </div>
              )}
              <div className={totalsRow}>
                <span>Shipping{order.shippingMethod ? ` · ${order.shippingMethod}` : ""}</span>
                <span>{n(order.shippingFee) ? money(order.shippingFee) : "Free"}</span>
              </div>
              <div className={totalsRow}>
                <span>Tax ({taxRate}%)</span>
                <span>{money(order.tax)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-16 font-extrabold text-ink">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
              {n(order.refundedTotal) > 0 && (
                <div className={`${totalsRow} text-[#dc2626]`}>
                  <span>Refunded</span>
                  <span>−{money(order.refundedTotal)}</span>
                </div>
              )}
            </div>
            {editable ? (
              <details className="mt-4 rounded-12 border border-line">
                <summary className="cursor-pointer px-4 py-3 text-14 font-bold text-accent">Edit items, prices, shipping & tax</summary>
                <div className="border-t border-line p-4">
                  <OrderEditor
                    orderId={order.id}
                    lines={order.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, sku: i.sku ?? "", unitPrice: n(i.unitPrice), quantity: i.quantity }))}
                    shippingFee={n(order.shippingFee)}
                    discount={n(order.discount)}
                    taxRate={taxRate}
                    taxShipping={taxShipping}
                  />
                </div>
              </details>
            ) : (
              canEdit && <p className="mt-3 text-12 text-muted">Items can be edited while an order is pending or processing and unpaid (not for card payments).</p>
            )}
          </div>

          {(order.notes || order.quote) && (
            <div className={card}>
              <h3 className={cardTitle}>Customer&apos;s note</h3>
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

          <div className={card}>
            <h3 className={cardTitle}>Activity & internal notes</h3>
            {canEdit && (
              <ActionForm action={addOrderNote.bind(null, order.id)} submitLabel="Add note" resetOnSuccess className="mb-4 grid gap-2">
                <textarea name="body" rows={2} placeholder="Note for staff (the customer never sees it)…" aria-label="Internal note" className={fieldClass} />
              </ActionForm>
            )}
            {order.activity.length ? (
              <ol className="grid gap-2.5">
                {order.activity.map((a) => (
                  <li key={a.id} className={`rounded-10 px-3 py-2 text-13 ${a.kind === "NOTE" ? "bg-[#fff8e6]" : "bg-[#f4f6f9]"}`}>
                    <span className="text-12 text-muted">
                      {time(a.createdAt)} · {a.authorName ?? "System"} · {a.kind === "NOTE" ? "Note" : "Event"}
                    </span>
                    <p className="whitespace-pre-line">{a.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-13 text-muted">Nothing yet. Status changes, edits, refunds and notes show up here.</p>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className={card}>
            <h3 className={cardTitle}>Status</h3>
            {cancelled ? (
              <p className="text-14 text-muted">This order is cancelled; its stock was released. Cancelled orders are final.</p>
            ) : !canEdit ? (
              <p className="text-14">
                {statusLabel(order.status)} <span className="block text-12 text-muted">View only: your role can&apos;t change orders.</span>
              </p>
            ) : (
              <StatusForm
                action={updateOrderStatus.bind(null, order.id)}
                current={order.status}
                options={Object.values(OrderStatus)}
                submitLabel="Update status"
                note="Each change emails the customer. Cancelling puts the items back in stock. Tracking is included in the Shipped email."
              >
                {order.status !== "SHIPPED" && order.status !== "DELIVERED" && (
                  <div className="grid gap-1.5">
                    <span className="text-12 text-muted">Tracking (optional, used when setting Shipped)</span>
                    <TrackingFields carrier={order.trackingCarrier} number={order.trackingNumber} />
                  </div>
                )}
              </StatusForm>
            )}
          </div>

          {(order.status === "SHIPPED" || order.status === "DELIVERED" || track) && (
            <div className={card}>
              <h3 className={cardTitle}>Tracking</h3>
              {track && (
                <p className="mb-3 text-14">
                  {track.carrier} · <b>{track.number}</b>{" "}
                  {track.url && (
                    <a href={track.url} target="_blank" rel="noopener noreferrer" className="font-bold text-accent">
                      Track ↗
                    </a>
                  )}
                </p>
              )}
              <ActionForm action={saveTracking.bind(null, order.id)} submitLabel="Save tracking" readOnly={!canEdit}>
                <TrackingFields carrier={order.trackingCarrier} number={order.trackingNumber} />
                {order.status === "SHIPPED" && <CheckField name="notify" label="Email the customer the Shipped email with this tracking" defaultChecked />}
              </ActionForm>
            </div>
          )}

          <div className={card}>
            <h3 className={cardTitle}>Payment & refunds</h3>
            <p className="text-14">
              {paymentStatusLabel(order.paymentStatus)} · total {money(order.total)}
              {n(order.refundedTotal) > 0 && <> · refunded {money(order.refundedTotal)}</>}
            </p>
            {order.refunds.map((r) => (
              <div key={r.id} className="mt-2 rounded-10 bg-[#f4f6f9] px-3 py-2 text-13">
                <b>{money(r.amount)}</b> {r.method === "STRIPE" ? "to the card (Stripe)" : "paid back manually"} · {shortDate(r.createdAt)}
                {r.createdBy && ` · ${r.createdBy}`}
                {r.reason && <span className="block text-muted">{r.reason}</span>}
                {r.restocked && <span className="block text-muted">Order cancelled, items back in stock</span>}
              </div>
            ))}
            {refundable && remaining > 0 && canRefund ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-13 font-bold text-accent">Refund…</summary>
                <div className="mt-3">
                  <ActionForm action={refundOrder.bind(null, order.id)} submitLabel="Refund">
                    <Field label={`Amount (up to ${money(remaining)})`} name="amount" type="number" min="0.01" max={String(remaining)} step="0.01" defaultValue={String(remaining)} />
                    <Field label="Reason (shown to the customer)" name="reason" placeholder="Returned item, damaged in transit…" />
                    {!cancelled && <CheckField name="cancel" label="Also cancel the order and put the items back in stock" />}
                    <CheckField name="notify" label="Email the customer about the refund" defaultChecked />
                    <p className="text-12 text-muted">
                      {order.paymentMethod === "CREDIT_CARD" ? "The money goes back to the card through Stripe." : "Pay the money back yourself (e.g. bank transfer); this records the refund."}
                    </p>
                  </ActionForm>
                </div>
              </details>
            ) : (
              !refundable && <p className="mt-2 text-12 text-muted">Refunds are possible once the order is paid.</p>
            )}
          </div>

          {addressEditable && (
            <details className={card}>
              <summary className="cursor-pointer text-14 font-bold">Edit customer & address</summary>
              <div className="mt-3">
                <ActionForm action={updateOrderAddress.bind(null, order.id)} submitLabel="Save details">
                  <Field label="Name" name="name" defaultValue={order.name} />
                  <Field label="Email" name="email" type="email" defaultValue={order.email} />
                  <Field label="Phone" name="phone" defaultValue={order.phone ?? ""} />
                  <Field label="Address" name="line" defaultValue={order.addressLine} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="City" name="city" defaultValue={order.city} />
                    <Field label="State" name="state" defaultValue={order.state} />
                    <Field label="ZIP" name="postalCode" defaultValue={order.postalCode} />
                    <label className={label}>
                      <span>Country</span>
                      <select name="country" defaultValue={order.countryCode ?? COUNTRIES.find((c) => c.name === order.country)?.code ?? "US"} className={`${select} w-full py-3`}>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </ActionForm>
              </div>
            </details>
          )}

          <div className={card}>
            <h3 className={cardTitle}>✉️ Email notifications</h3>
            {order.emails.length ? (
              order.emails.map((e) => (
                <div key={e.id} className="border-b border-[#f0f1f3] py-1.5 text-13 text-muted last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span>{shortDate(e.createdAt)}</span>
                    <span className="text-ink">{e.kind === "CONFIRMATION" ? "Order received" : e.kind === "REFUND" ? "Refund" : statusLabel(e.orderStatus)}</span>
                    {e.sentAt ? (
                      <span className="text-success">Sent</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className={e.error ? "text-[#dc2626]" : ""}>{e.error ? `Failed (${e.attempts}×)` : "Queued"}</span>
                        {canEdit && (
                          <form action={retryOrderEmail.bind(null, e.id)}>
                            <button type="submit" className={textButton}>
                              Retry
                            </button>
                          </form>
                        )}
                      </span>
                    )}
                  </div>
                  {!e.sentAt && e.error && <p className="mt-1 text-12 break-words text-[#dc2626]">{e.error}</p>}
                </div>
              ))
            ) : (
              <p className="text-13 text-muted">No emails yet.</p>
            )}
            <p className="mt-2 text-12 text-muted">Sent to {order.email}. Failed emails are retried automatically by the email jobs.</p>
          </div>
        </div>
      </div>
    </>
  );
}
