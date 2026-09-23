"use client";

import Image from "next/image";
import Link from "next/link";
import { unitPriceOf, useCart } from "@/lib/cart-store";
import type { CartLine as Line } from "@/lib/cart-types";
import { money } from "@/lib/format";

// One cart row (the prototype's li()): image, name, unit price, quantity stepper, line total, remove.
export function CartLine({ line }: { line: Line }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const unit = unitPriceOf(line);
  const step = "size-[30px] cursor-pointer text-15 text-ink hover:bg-line disabled:cursor-default disabled:opacity-40";

  return (
    <div className="flex items-center gap-3.5 border-b border-line py-3.5">
      <Link href={`/product/${line.slug}`} className="relative grid size-16 flex-none place-items-center overflow-hidden rounded-12 bg-[#f1f3f5]">
        {line.image ? <Image src={line.image} alt="" fill sizes="64px" className="rounded-12 bg-white object-contain" /> : <span className="text-26">📦</span>}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/product/${line.slug}`} className="block text-14 leading-[1.3] font-bold">
          {line.name}
        </Link>
        <small className="text-muted">
          {line.variantName ? `${line.variantName} · ` : ""}
          {money(unit)} each
        </small>
        <div className="mt-2 inline-flex items-center overflow-hidden rounded-pill border border-line">
          <button type="button" aria-label="Decrease quantity" className={step} onClick={() => setQuantity(line.key, line.quantity - 1)}>
            −
          </button>
          <span className="min-w-[26px] text-center text-13 font-bold">{line.quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            className={step}
            disabled={line.quantity >= line.maxQty}
            onClick={() => setQuantity(line.key, line.quantity + 1)}
          >
            +
          </button>
        </div>
      </div>
      <b className="text-14">{money(unit * line.quantity)}</b>
      <button type="button" aria-label={`Remove ${line.name}`} className="cursor-pointer p-1.5 text-muted hover:text-accent" onClick={() => remove(line.key)}>
        ✕
      </button>
    </div>
  );
}
