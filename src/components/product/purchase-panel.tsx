"use client";

import Link from "next/link";
import { useState } from "react";
import { money, stars } from "@/lib/format";
import { lineUnitPrice, tierUnitPrice, type Tier } from "@/lib/pricing";

type Props = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice: number | null;
  rating: number | null;
  stock: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "BACKORDER";
  description: string | null;
  details: { label: string; value: string }[];
  variants: { id: string; attribute: string; name: string; priceDelta: number }[];
  tiers: Tier[];
};

// Product info column (the prototype's .pinfo): live price for quantity/variant, bulk tiers, specs, buy row.
// "Add to cart" is wired in Phase 7 and "Save for later" in Phase 8.
export function PurchasePanel(p: Props) {
  const [variant, setVariant] = useState(0);
  const [qty, setQty] = useState(1);
  const maxQty = p.stock ?? 999;
  const delta = p.variants[variant]?.priceDelta ?? 0;
  const unit = lineUnitPrice(p.price, p.tiers, qty, delta);
  const low = p.stock != null && p.stock < 10;
  const out = p.availability === "OUT_OF_STOCK" || p.stock === 0;

  const stockLabel = out
    ? "Out of stock"
    : p.availability === "BACKORDER"
      ? "On backorder"
      : p.stock == null
        ? "In stock"
        : low
          ? `Only ${p.stock} left`
          : `In stock (${p.stock})`;

  const btn = "btn cursor-pointer border-0 text-15";
  const outline = "btn cursor-pointer border border-line bg-transparent text-15 text-ink hover:border-accent";

  return (
    <div>
      <small className="text-12 font-bold tracking-[.08em] text-accent uppercase">{p.brand}</small>
      <h1 className="mt-1.5 mb-2.5 text-[clamp(22px,3vw,30px)] leading-[1.2] font-bold tracking-[-.5px]">{p.name}</h1>
      {p.rating != null && (
        <div className="text-13 text-star">
          {stars(p.rating)} <i className="text-muted not-italic">{p.rating.toFixed(1)} rating</i>
        </div>
      )}

      <div className="my-3.5 text-[34px] font-extrabold" aria-live="polite">
        {money(unit)}
        {p.compareAtPrice && unit === p.price && (
          <s className="ml-2.5 text-18 font-normal text-muted">{money(p.compareAtPrice)}</s>
        )}
      </div>
      <span
        className={`inline-block rounded-pill px-3 py-1 text-12 font-bold ${
          low || out ? "bg-[#f59e0b22] text-warning" : "bg-[#16a34a22] text-success"
        }`}
      >
        {stockLabel}
      </span>

      {p.description && <p className="mt-4 text-muted whitespace-pre-line">{p.description}</p>}

      {p.variants.length > 0 && (
        <div className="my-4">
          <b className="mb-2 block text-13 font-semibold text-muted">{p.variants[0].attribute}</b>
          <div className="flex flex-wrap gap-2">
            {p.variants.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={i === variant}
                onClick={() => setVariant(i)}
                className={`cursor-pointer rounded-10 border px-3.5 py-[9px] text-ui transition ${
                  i === variant ? "border-accent bg-accent-soft font-bold text-accent" : "border-line bg-white text-ink"
                }`}
              >
                {v.name}
                {v.priceDelta ? ` (+${money(v.priceDelta)})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {p.tiers.length > 0 && (
        <div className="my-4 rounded-14 border border-[#f3c1c6] bg-accent-soft px-4 py-3.5">
          <b className="mb-2 block text-13 text-[#b3141f]">Bulk pricing</b>
          <table className="w-full border-collapse text-ui">
            <tbody>
              {p.tiers.map((t, i) => (
                <tr key={t.minQty} className={i < p.tiers.length - 1 ? "border-b border-[#f3c1c6]" : ""}>
                  <td className="px-1 py-1.5">
                    {t.minQty}
                    {t.maxQty == null ? "+" : `–${t.maxQty}`} units
                  </td>
                  <td className="px-1 py-1.5">{money(tierUnitPrice(p.price, [t], t.minQty))} / unit</td>
                  <td className="px-1 py-1.5">{t.multiplier < 1 ? `Save ${Math.round((1 - t.multiplier) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {p.details.length > 0 && (
        <table className="my-[18px] w-full border-collapse text-14">
          <tbody>
            {p.details.map((d) => (
              <tr key={d.label}>
                <td className="w-2/5 border-b border-line py-2.5 text-muted">{d.label}</td>
                <td className="border-b border-line py-2.5">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-pill border border-line">
          <button type="button" aria-label="Decrease quantity" className="h-11 w-10 cursor-pointer text-18 text-ink hover:bg-line" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span className="min-w-[30px] text-center font-bold" aria-live="polite">
            {qty}
          </span>
          <button type="button" aria-label="Increase quantity" className="h-11 w-10 cursor-pointer text-18 text-ink hover:bg-line" onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>
            +
          </button>
        </div>
        <button type="button" className={btn} disabled={out}>
          Add to cart
        </button>
        <Link href={`/?quote=${encodeURIComponent(p.slug)}#contact`} className={outline}>
          Request quote
        </Link>
        <button type="button" className={outline}>
          ♡ Save for later
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 text-12 text-muted">
        {["🚚 Fast shipping", "🛡️ Genuine warranty", "↩️ 30-day returns"].map((t) => (
          <div key={t} className="rounded-12 border border-line bg-surface p-3">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
