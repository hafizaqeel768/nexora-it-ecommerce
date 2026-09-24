import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { PrintDoc } from "@/components/print-doc";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { money, paymentStatusLabel, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

const paymentKey = { CREDIT_CARD: "card", PURCHASE_ORDER: "purchaseOrder", BANK_TRANSFER: "bankTransfer" } as const;

// Invoice for an order. Like the order page, the unguessable order id is the key, so customers can open and
// save it too; staff open it from Admin → Orders.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, store, payments] = await Promise.all([
    db.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } }, refunds: { orderBy: { createdAt: "asc" } } } }),
    getConfig("store"),
    getConfig("payments"),
  ]);
  if (!order) notFound();
  const n = (d: { toString(): string }) => Number(d.toString());
  const pay = payments[paymentKey[order.paymentMethod]];
  const unpaid = order.paymentStatus === "UNPAID" && order.status !== "CANCELLED";
  const address = [order.addressLine, [order.city, order.state, order.postalCode].filter(Boolean).join(", "), order.country].filter(Boolean).join("\n");
  const line = "flex justify-between gap-6 py-1";

  return (
    <PrintDoc
      store={store}
      title={order.status === "CANCELLED" ? "Invoice (cancelled)" : "Invoice"}
      meta={[
        ["Invoice no.", order.number],
        ["Date", shortDate(order.createdAt)],
        ["Payment", `${pay.label} · ${paymentStatusLabel(order.paymentStatus)}`],
      ]}
      actions={<PrintButton />}
    >
      <section className="mb-8 grid grid-cols-2 gap-6 max-sm:grid-cols-1">
        <div>
          <h2 className="mb-1 text-12 font-bold tracking-[.08em] text-[#777] uppercase">Bill to</h2>
          <p className="whitespace-pre-line">
            <b>{order.name}</b>
            {`\n${order.email}`}
            {order.phone && `\n${order.phone}`}
          </p>
        </div>
        <div>
          <h2 className="mb-1 text-12 font-bold tracking-[.08em] text-[#777] uppercase">Ship to</h2>
          <p className="whitespace-pre-line">{address}</p>
          {order.shippingMethod && <p className="mt-1 text-13 text-[#555]">{order.shippingMethod}</p>}
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#111] text-left text-12 tracking-[.06em] uppercase">
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-[#e5e5e5] align-top">
              <td className="py-2 pr-3">{i.name}</td>
              <td className="py-2 pr-3 text-13 text-[#555]">{i.sku ?? ""}</td>
              <td className="py-2 text-right">{i.quantity}</td>
              <td className="py-2 text-right">{money(i.unitPrice)}</td>
              <td className="py-2 text-right">{money(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-[min(320px,100%)]">
        <div className={line}>
          <span>Subtotal</span>
          <span>{money(order.subtotal)}</span>
        </div>
        {n(order.discount) > 0 && (
          <div className={line}>
            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
            <span>−{money(order.discount)}</span>
          </div>
        )}
        <div className={line}>
          <span>Shipping</span>
          <span>{money(order.shippingFee)}</span>
        </div>
        <div className={line}>
          <span>Tax{order.taxRate != null ? ` (${n(order.taxRate)}%)` : ""}</span>
          <span>{money(order.tax)}</span>
        </div>
        <div className={`${line} mt-1 border-t-2 border-[#111] pt-2 text-18 font-black`}>
          <span>Total (USD)</span>
          <span>{money(order.total)}</span>
        </div>
        {order.refunds.map((r) => (
          <div key={r.id} className={`${line} text-13 text-[#555]`}>
            <span>Refunded {shortDate(r.createdAt)}</span>
            <span>−{money(r.amount)}</span>
          </div>
        ))}
        {n(order.refundedTotal) > 0 && (
          <div className={`${line} font-bold`}>
            <span>Net paid</span>
            <span>{money(n(order.total) - n(order.refundedTotal))}</span>
          </div>
        )}
      </div>

      {unpaid && pay.instructions && (
        <section className="mt-8 rounded-10 border border-[#e5e5e5] p-4">
          <h2 className="mb-1 text-12 font-bold tracking-[.08em] text-[#777] uppercase">How to pay</h2>
          <p className="whitespace-pre-line">{pay.instructions}</p>
          <p className="mt-1 text-13 text-[#555]">Please quote invoice no. {order.number} with your payment.</p>
        </section>
      )}
      <p className="mt-10 text-center text-12 text-[#777]">Thank you for your business. {store.supportEmail && `Questions? ${store.supportEmail}`}</p>
    </PrintDoc>
  );
}
