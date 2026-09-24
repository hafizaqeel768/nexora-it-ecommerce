import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { PrintDoc } from "@/components/print-doc";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { trackingInfo } from "@/lib/tracking";

export const metadata: Metadata = { title: "Packing slip", robots: { index: false } };

// Packing slip for the warehouse (staff only): what goes in the box and where it goes. No prices.
export default async function PackingSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/print/packing-slip/${id}`);
  const [order, store] = await Promise.all([db.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } } } }), getConfig("store")]);
  if (!order) notFound();
  const track = trackingInfo(order.trackingCarrier, order.trackingNumber);
  const units = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <PrintDoc
      store={store}
      title="Packing slip"
      meta={[
        ["Order", order.number],
        ["Order date", shortDate(order.createdAt)],
        ["Shipping", order.shippingMethod ?? "—"],
        ...(track ? ([["Tracking", `${track.carrier} ${track.number}`]] as [string, string][]) : []),
      ]}
      actions={<PrintButton />}
    >
      <section className="mb-8 rounded-10 border-2 border-[#111] p-4 text-16">
        <h2 className="mb-1 text-12 font-bold tracking-[.08em] text-[#777] uppercase">Ship to</h2>
        <p className="whitespace-pre-line">
          <b>{order.name}</b>
          {`\n${order.addressLine}\n${[order.city, order.state, order.postalCode].filter(Boolean).join(", ")}\n${order.country}`}
          {order.phone && `\n${order.phone}`}
        </p>
      </section>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#111] text-left text-12 tracking-[.06em] uppercase">
            <th className="w-10 py-2">✓</th>
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-[#e5e5e5] align-top">
              <td className="py-2.5">
                <span className="inline-block size-4 border-2 border-[#111]" />
              </td>
              <td className="py-2.5 pr-3">{i.name}</td>
              <td className="py-2.5 pr-3 font-mono text-13">{i.sku ?? ""}</td>
              <td className="py-2.5 text-right text-16 font-bold">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-13 text-[#555]">
        {order.items.length} line{order.items.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"}
      </p>
      {order.notes && (
        <section className="mt-6 rounded-10 bg-[#f4f4f5] p-4 print:border print:border-[#ccc] print:bg-white">
          <h2 className="mb-1 text-12 font-bold tracking-[.08em] text-[#777] uppercase">Customer&apos;s note</h2>
          <p className="whitespace-pre-line">{order.notes}</p>
        </section>
      )}
    </PrintDoc>
  );
}
