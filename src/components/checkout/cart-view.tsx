"use client";

import Link from "next/link";
import { useState } from "react";
import { applyCoupon } from "@/app/actions/checkout";
import { CartLine } from "@/components/cart/cart-line";
import { OrderSummary } from "@/components/cart/order-summary";
import { useStoreRules } from "@/components/store-rules-provider";
import { totalsOf, useCart } from "@/lib/cart-store";

// Shopping cart page (the prototype's cartPage()).
export function CartView() {
  const { lines, promo, setPromo } = useCart();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const rules = useStoreRules();
  const totals = totalsOf(lines, promo?.percent ?? 0, rules);

  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const res = await applyCoupon(code);
    setBusy(false);
    if ("error" in res) setMessage({ ok: false, text: res.error });
    else {
      setPromo(res);
      setMessage({ ok: true, text: `Promo applied: ${res.percent}% off` });
      setCode("");
    }
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-[22px] text-13 text-muted">
        <Link href="/" className="text-accent">
          Home
        </Link>{" "}
        / Cart
      </nav>
      <h1 className="mt-1.5 mb-2.5 text-[clamp(26px,4vw,36px)] leading-[1.15] font-bold tracking-[-.8px]">Shopping cart</h1>

      {lines.length === 0 ? (
        <>
          <p className="section-sub">Your cart is empty.</p>
          <Link href="/shop" className="btn">
            Browse products
          </Link>
        </>
      ) : (
        <div className="mt-[26px] grid grid-cols-[1.5fr_1fr] items-start gap-8 max-lg:grid-cols-1">
          <div>
            {lines.map((l) => (
              <CartLine key={l.key} line={l} />
            ))}
            <p className="mt-4">
              <Link href="/shop" className="text-14 text-accent">
                ← Continue shopping
              </Link>
            </p>
          </div>
          <OrderSummary totals={totals} promoPercent={promo?.percent} taxPercent={rules.taxPercent}>
            {promo ? (
              <p className="mt-3.5 flex items-center justify-between text-13 text-success">
                <span>
                  Code <b>{promo.code}</b> applied
                </span>
                <button type="button" className="cursor-pointer text-muted hover:text-accent" onClick={() => (setPromo(null), setMessage(null))}>
                  Remove
                </button>
              </p>
            ) : (
              <form
                className="mt-3.5 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void apply();
                }}
              >
                <input
                  className="min-w-0 flex-1 rounded-12 border border-line bg-surface px-3.5 py-3 text-14 outline-none focus:border-accent"
                  placeholder="Promo code (NEXORA10)"
                  aria-label="Promo code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button type="submit" disabled={busy} className="cursor-pointer rounded-pill bg-ink px-4 py-2.5 font-bold text-bg transition hover:bg-accent hover:text-white disabled:opacity-60">
                  Apply
                </button>
              </form>
            )}
            {message && !promo?.code && (
              <p role="status" className={`mt-2 text-13 ${message.ok ? "text-success" : "text-accent"}`}>
                {message.text}
              </p>
            )}
            <Link href="/checkout" className="btn mt-3.5 block text-center">
              Proceed to checkout
            </Link>
          </OrderSummary>
        </div>
      )}
    </>
  );
}
