"use client";

import { useEffect, useState } from "react";
import { editOrderItems, searchProductsForOrder, type EditLine } from "@/app/actions/orders";
import { fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { money } from "@/lib/format";

type Row = EditLine & { key: string; price: string; qty: string };
type Hit = Awaited<ReturnType<typeof searchProductsForOrder>>[number];

const cell = `${fieldClass} py-2`;
const cents = (n: number) => Math.round(n * 100) / 100;
let seq = 0;

// "Edit items" on an open, unpaid order: change lines/prices/quantities, add products or custom lines,
// shipping, discount and tax. Totals are previewed here and recomputed on the server.
export function OrderEditor({
  orderId,
  lines,
  shippingFee,
  discount,
  taxRate,
  taxShipping,
}: {
  orderId: string;
  lines: EditLine[];
  shippingFee: number;
  discount: number;
  taxRate: number;
  taxShipping: boolean;
}) {
  const toRow = (l: EditLine): Row => ({ ...l, key: l.id ?? `n${++seq}`, price: String(l.unitPrice), qty: String(l.quantity) });
  const [rows, setRows] = useState<Row[]>(lines.map(toRow));
  const [ship, setShip] = useState(String(shippingFee));
  const [disc, setDisc] = useState(String(discount));
  const [rate, setRate] = useState(String(taxRate));
  const [taxShip, setTaxShip] = useState(taxShipping);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  // After a save the page sends the stored lines (new ones now have ids): take them over.
  const serverKey = JSON.stringify({ lines, shippingFee, discount, taxRate });
  const [synced, setSynced] = useState(serverKey);
  if (serverKey !== synced) {
    setSynced(serverKey);
    setRows(lines.map(toRow));
    setShip(String(shippingFee));
    setDisc(String(discount));
    setRate(String(taxRate));
  }

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => searchProductsForOrder(q).then(setHits, () => setHits([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const set = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const subtotal = cents(rows.reduce((s, r) => s + cents((Number(r.price) || 0) * (Number(r.qty) || 0)), 0));
  const d = Number(disc) || 0;
  const s = Number(ship) || 0;
  const tax = cents(((subtotal - d + (taxShip ? s : 0)) * (Number(rate) || 0)) / 100);
  const total = cents(subtotal - d + s + tax);

  const payload = JSON.stringify({
    lines: rows.map((r) => ({ id: r.id, productId: r.productId, name: r.name, sku: r.sku, unitPrice: Number(r.price), quantity: Number(r.qty) })),
    shippingFee: Number(ship),
    discount: Number(disc),
    taxRate: Number(rate),
    taxShipping: taxShip,
  });

  return (
    <ActionForm action={editOrderItems.bind(null, orderId)} submitLabel="Save changes">
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-2">
        <div className="grid grid-cols-[3fr_1.2fr_1fr_.8fr_1fr_auto] gap-2 text-12 text-muted max-md:hidden">
          <span>Item</span>
          <span>SKU</span>
          <span>Unit price</span>
          <span>Qty</span>
          <span>Line total</span>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[3fr_1.2fr_1fr_.8fr_1fr_auto] items-center gap-2 max-md:grid-cols-2">
            <input value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} aria-label="Item" className={cell} />
            <input value={r.sku ?? ""} onChange={(e) => set(r.key, { sku: e.target.value })} aria-label="SKU" className={cell} />
            <input value={r.price} onChange={(e) => set(r.key, { price: e.target.value })} type="number" min="0" step="0.01" aria-label="Unit price" className={cell} />
            <input value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value })} type="number" min="1" step="1" aria-label="Quantity" className={cell} />
            <span className="text-14">{money(cents((Number(r.price) || 0) * (Number(r.qty) || 0)))}</span>
            <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} className="cursor-pointer text-13 text-muted hover:text-accent">
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-2 rounded-12 border border-dashed border-line p-3">
        <div className="flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a product: search name or SKU…" aria-label="Search products" className={`${cell} max-w-[340px]`} />
          <button
            type="button"
            onClick={() => setRows((r) => [...r, toRow({ id: null, productId: null, name: "Custom item", sku: "", unitPrice: 0, quantity: 1 })])}
            className="cursor-pointer text-13 font-bold text-accent hover:underline"
          >
            + Custom line
          </button>
        </div>
        {q.trim().length >= 2 &&
          hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setRows((r) => [...r, toRow({ id: null, productId: h.id, name: h.name, sku: h.sku, unitPrice: h.price, quantity: 1 })]);
                setQ("");
                setHits([]);
              }}
              className="flex cursor-pointer justify-between gap-3 rounded-8 px-2 py-1.5 text-left text-13 hover:bg-[#f3f4f6]"
            >
              <span>
                {h.name} {h.sku && <span className="text-muted">· {h.sku}</span>} {h.draft && <span className="text-warning">(draft)</span>}
              </span>
              <span className="flex-none text-muted">
                {money(h.price)} · {h.stock == null ? "stock not tracked" : `${h.stock} in stock`}
              </span>
            </button>
          ))}
      </div>

      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <label className="grid gap-1.5 text-13 text-muted">
          <span>Shipping (USD)</span>
          <input value={ship} onChange={(e) => setShip(e.target.value)} type="number" min="0" step="0.01" className={cell} />
        </label>
        <label className="grid gap-1.5 text-13 text-muted">
          <span>Discount (USD)</span>
          <input value={disc} onChange={(e) => setDisc(e.target.value)} type="number" min="0" step="0.01" className={cell} />
        </label>
        <label className="grid gap-1.5 text-13 text-muted">
          <span>Tax rate (%)</span>
          <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" min="0" max="50" step="0.001" className={cell} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-13">
        <input type="checkbox" checked={taxShip} onChange={(e) => setTaxShip(e.target.checked)} className="accent-accent" /> Tax also applies to shipping
      </label>
      <p className="text-14">
        Subtotal {money(subtotal)} − discount {money(d)} + shipping {money(s)} + tax {money(tax)} = <b>{money(total)}</b>
      </p>
      <p className="text-12 text-muted">Stock follows the quantity changes for tracked products. The customer is not emailed automatically.</p>
    </ActionForm>
  );
}
