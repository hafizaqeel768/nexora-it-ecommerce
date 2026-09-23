"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrder, type CheckoutInput } from "@/app/actions/checkout";
import { OrderSummary } from "@/components/cart/order-summary";
import { totalsOf, unitPriceOf, useCart } from "@/lib/cart-store";
import { money } from "@/lib/format";

const field =
  "w-full rounded-12 border border-line bg-surface px-3.5 py-3 text-14 text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_#d21f2b22]";
const label = "grid gap-1.5 text-13 text-muted";
const row = "grid grid-cols-2 gap-3.5 max-sm:grid-cols-1";

const payments = [
  { value: "card", label: "Credit card" },
  { value: "purchase_order", label: "Purchase order" },
  { value: "bank_transfer", label: "Bank transfer" },
] as const;

// Checkout (the prototype's checkout()). The server re-prices the cart; card payments continue on Stripe.
export function CheckoutView({
  cardEnabled,
  canceled,
  prefill,
}: {
  cardEnabled: boolean;
  canceled: boolean;
  prefill: Partial<Record<"name" | "email" | "phone" | "line" | "city" | "state" | "postalCode" | "country", string>>;
}) {
  const router = useRouter();
  const { lines, promo, clear } = useCart();
  const [payment, setPayment] = useState<CheckoutInput["payment"]>(cardEnabled ? "card" : "purchase_order");
  const [error, setError] = useState<string | null>(canceled ? "Card payment was cancelled. Your cart is still here." : null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const totals = totalsOf(lines, promo?.percent ?? 0);

  if (!lines.length) {
    return (
      <>
        <h1 className="mt-1.5 mb-2.5 text-[clamp(26px,4vw,36px)] font-bold">Checkout</h1>
        <p className="section-sub">Your cart is empty.</p>
        <Link href="/shop" className="btn">
          Browse products
        </Link>
      </>
    );
  }

  const submit = (form: FormData) => {
    const v = (k: string) => String(form.get(k) ?? "");
    const input: CheckoutInput = {
      lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      couponCode: promo?.code ?? null,
      contact: { name: v("name"), email: v("email"), phone: v("phone") },
      address: { line: v("line"), city: v("city"), state: v("state"), postalCode: v("postalCode"), country: v("country") },
      payment,
      notes: v("notes"),
    };
    startTransition(async () => {
      const res = await placeOrder(input);
      if ("error" in res) {
        setError(res.error);
        setFields(res.fields ?? {});
        return;
      }
      if (res.redirect.startsWith("/order/")) {
        clear();
        router.push(res.redirect);
      } else {
        window.location.href = res.redirect; // Stripe Checkout; the cart is cleared once payment is confirmed
      }
    });
  };

  const input = (name: string, text: string, opts: { type?: string; required?: boolean; defaultValue?: string; autoComplete?: string } = {}) => (
    <label className={label}>
      <span>
        {text}
        {opts.required ? " *" : ""}
      </span>
      <input
        className={field}
        name={name}
        type={opts.type ?? "text"}
        required={opts.required}
        defaultValue={prefill[name as keyof typeof prefill] || opts.defaultValue}
        autoComplete={opts.autoComplete}
        aria-invalid={!!fields[name]}
      />
      {fields[name] && <span className="text-accent">{fields[name]}</span>}
    </label>
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-[22px] text-13 text-muted">
        <Link href="/cart" className="text-accent">
          Cart
        </Link>{" "}
        / Checkout
      </nav>
      <h1 className="mt-1.5 mb-2.5 text-[clamp(26px,4vw,36px)] leading-[1.15] font-bold tracking-[-.8px]">Checkout</h1>

      <div className="mt-[26px] grid grid-cols-[1.5fr_1fr] items-start gap-8 max-lg:grid-cols-1">
        <form action={submit} className="grid gap-3.5" noValidate>
          <h3 className="text-18 font-bold">Contact</h3>
          <div className={row}>
            {input("name", "Full name", { required: true, autoComplete: "name" })}
            {input("email", "Email", { type: "email", required: true, autoComplete: "email" })}
          </div>
          {input("phone", "Phone", { type: "tel", autoComplete: "tel" })}

          <h3 className="mt-3.5 text-18 font-bold">Shipping address</h3>
          {input("line", "Address", { required: true, autoComplete: "street-address" })}
          <div className={row}>
            {input("city", "City", { required: true, autoComplete: "address-level2" })}
            {input("state", "State / Region", { autoComplete: "address-level1" })}
          </div>
          <div className={row}>
            {input("postalCode", "ZIP / Postal code", { required: true, autoComplete: "postal-code" })}
            {input("country", "Country", { required: true, defaultValue: "United States", autoComplete: "country-name" })}
          </div>

          <h3 className="mt-3.5 text-18 font-bold">Payment</h3>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Payment method">
            {payments.map((p) => {
              const disabled = p.value === "card" && !cardEnabled;
              return (
                <label
                  key={p.value}
                  className={`rounded-12 border bg-surface px-4 py-3 text-14 ${
                    payment === p.value ? "border-accent" : "border-line"
                  } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    className="mr-2 accent-accent"
                    value={p.value}
                    checked={payment === p.value}
                    disabled={disabled}
                    onChange={() => setPayment(p.value)}
                  />
                  {p.label}
                </label>
              );
            })}
          </div>
          <p className="text-12 text-muted">
            {payment === "card"
              ? "You'll enter your card on Stripe's secure payment page (test mode — use card 4242 4242 4242 4242)."
              : payment === "purchase_order"
                ? "We'll confirm your order and send an invoice against your purchase order."
                : "We'll email bank transfer details; the order ships once payment arrives."}
            {!cardEnabled && " Card payments are not configured yet."}
          </p>

          <label className={label}>
            <span>Order notes (optional)</span>
            <textarea className={field} rows={3} name="notes" />
          </label>

          {error && (
            <p role="alert" className="rounded-12 border border-[#f3c1c6] bg-accent-soft px-4 py-3 text-14 text-[#b3141f]">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="btn cursor-pointer border-0 text-15 disabled:opacity-60">
            {pending ? "Placing order…" : `Place order · ${money(totals.total)}`}
          </button>
        </form>

        <OrderSummary totals={totals} promoPercent={promo?.percent}>
          <div className="mt-3.5">
            {lines.map((l) => (
              <div key={l.key} className="flex justify-between gap-3 py-[7px] text-14 text-muted">
                <span className="min-w-0 truncate">
                  {l.name} × {l.quantity}
                </span>
                <span className="flex-none">{money(unitPriceOf(l) * l.quantity)}</span>
              </div>
            ))}
          </div>
        </OrderSummary>
      </div>
    </>
  );
}
