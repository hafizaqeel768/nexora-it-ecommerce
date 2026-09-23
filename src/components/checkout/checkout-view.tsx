"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrder, type CheckoutInput } from "@/app/actions/checkout";
import { OrderSummary } from "@/components/cart/order-summary";
import { totalsOf, unitPriceOf, useCart } from "@/lib/cart-store";
import { COUNTRIES, US_STATES, stateKey } from "@/lib/countries";
import { money } from "@/lib/format";
import { NO_SHIPPING_OR_TAX } from "@/lib/pricing";
import { shippingOptions, shipsTo, taxRateFor, type TaxRateData, type ZoneData } from "@/lib/shipping";

const field =
  "w-full rounded-12 border border-line bg-surface px-3.5 py-3 text-14 text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_#d21f2b22]";
const label = "grid gap-1.5 text-13 text-muted";
const row = "grid grid-cols-2 gap-3.5 max-sm:grid-cols-1";

export type CheckoutPayment = { value: CheckoutInput["payment"]; label: string; instructions: string; available: boolean };
type Prefill = Partial<Record<"name" | "email" | "phone" | "line" | "city" | "state" | "postalCode" | "country", string>>;

// Checkout (the prototype's checkout()). Shipping methods, tax and totals update live from the address; the
// server recomputes everything when the order is placed. Card payments continue on Stripe.
export function CheckoutView({
  canceled,
  prefill,
  zones,
  taxRates,
  payments,
  settings,
  taxExempt,
}: {
  canceled: boolean;
  prefill: Prefill;
  zones: ZoneData[];
  taxRates: TaxRateData[];
  payments: CheckoutPayment[];
  settings: { minOrder: number; requirePhone: boolean; showNotes: boolean };
  taxExempt: boolean;
}) {
  const router = useRouter();
  const { lines, promo, clear } = useCart();
  const ships = shipsTo(zones);
  const countryChoices = ships.all ? COUNTRIES : COUNTRIES.filter((c) => ships.countries.includes(c.code));

  const [country, setCountry] = useState(prefill.country && countryChoices.some((c) => c.code === prefill.country) ? prefill.country : (countryChoices[0]?.code ?? ""));
  const [state, setState] = useState(prefill.state ?? "");
  const [methodId, setMethodId] = useState("");
  const firstAvailable = payments.find((p) => p.available)?.value ?? payments[0]?.value;
  const [payment, setPayment] = useState<CheckoutInput["payment"] | undefined>(firstAvailable);
  const [error, setError] = useState<string | null>(canceled ? "Card payment was cancelled. Your cart is still here." : null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const goods = totalsOf(lines, promo?.percent ?? 0, NO_SHIPPING_OR_TAX);
  const discounted = goods.subtotal - goods.discount;
  const options = shippingOptions(zones, country, state, discounted);
  const chosen = options.find((o) => o.id === methodId) ?? options[0];
  const tax = taxExempt ? null : taxRateFor(taxRates, country, state);
  const totals = totalsOf(lines, promo?.percent ?? 0, { shipping: chosen?.cost ?? 0, taxPercent: tax?.rate ?? 0, taxShipping: tax?.shipping });
  const belowMinimum = settings.minOrder > 0 && discounted < settings.minOrder;
  const selectedPayment = payments.find((p) => p.value === payment);

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

  // onSubmit (not a form action), so the typed values stay in the form when the server reports a problem.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const v = (k: string) => String(form.get(k) ?? "");
    if (!payment) return setError("Please choose a payment method.");
    const input: CheckoutInput = {
      lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      couponCode: promo?.code ?? null,
      contact: { name: v("name"), email: v("email"), phone: v("phone") },
      address: { line: v("line"), city: v("city"), state, postalCode: v("postalCode"), country },
      shippingMethodId: chosen?.id ?? "",
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
        defaultValue={prefill[name as keyof Prefill] || opts.defaultValue}
        autoComplete={opts.autoComplete}
        aria-invalid={!!fields[name]}
      />
      {fields[name] && <span className="text-accent">{fields[name]}</span>}
    </label>
  );

  const choice = (active: boolean, disabled = false) =>
    `flex items-center gap-2.5 rounded-12 border bg-surface px-4 py-3 text-14 ${active ? "border-accent" : "border-line"} ${
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
    }`;

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
        <form onSubmit={submit} className="grid gap-3.5" noValidate>
          <h3 className="text-18 font-bold">Contact</h3>
          <div className={row}>
            {input("name", "Full name", { required: true, autoComplete: "name" })}
            {input("email", "Email", { type: "email", required: true, autoComplete: "email" })}
          </div>
          {input("phone", "Phone", { type: "tel", required: settings.requirePhone, autoComplete: "tel" })}

          <h3 className="mt-3.5 text-18 font-bold">Shipping address</h3>
          <label className={label}>
            <span>Country *</span>
            <select
              className={field}
              name="country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setState("");
              }}
              autoComplete="country"
              aria-invalid={!!fields.country}
            >
              {countryChoices.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {fields.country && <span className="text-accent">{fields.country}</span>}
          </label>
          {input("line", "Address", { required: true, autoComplete: "street-address" })}
          <div className={row}>
            {input("city", "City", { required: true, autoComplete: "address-level2" })}
            <label className={label}>
              <span>State / Region{country === "US" ? " *" : ""}</span>
              {country === "US" ? (
                <select className={field} name="state" value={stateKey("US", state)} onChange={(e) => setState(e.target.value)} aria-invalid={!!fields.state}>
                  <option value="">Choose…</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={field} name="state" value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" />
              )}
              {fields.state && <span className="text-accent">{fields.state}</span>}
            </label>
          </div>
          {input("postalCode", "ZIP / Postal code", { required: true, autoComplete: "postal-code" })}

          <h3 className="mt-3.5 text-18 font-bold">Shipping method</h3>
          {options.length ? (
            <div className="grid gap-2.5" role="radiogroup" aria-label="Shipping method">
              {options.map((o) => (
                <label key={o.id} className={choice(chosen?.id === o.id)}>
                  <input type="radio" name="shippingMethod" className="accent-accent" checked={chosen?.id === o.id} onChange={() => setMethodId(o.id)} />
                  <span className="flex-1">{o.name}</span>
                  <b className="text-ink">{o.cost ? money(o.cost) : "Free"}</b>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-12 border border-line bg-surface px-4 py-3 text-14 text-muted">Sorry, we don&apos;t ship to this address yet. Please contact us for a quote.</p>
          )}

          <h3 className="mt-3.5 text-18 font-bold">Payment</h3>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Payment method">
            {payments.map((p) => (
              <label key={p.value} className={choice(payment === p.value, !p.available)}>
                <input
                  type="radio"
                  name="payment"
                  className="accent-accent"
                  value={p.value}
                  checked={payment === p.value}
                  disabled={!p.available}
                  onChange={() => setPayment(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
          {selectedPayment && <p className="text-12 whitespace-pre-line text-muted">{selectedPayment.instructions}</p>}
          {payments.some((p) => !p.available) && <p className="text-12 text-muted">Card payments are not available right now.</p>}

          {settings.showNotes && (
            <label className={label}>
              <span>Order notes (optional)</span>
              <textarea className={field} rows={3} name="notes" />
            </label>
          )}

          {belowMinimum && (
            <p className="rounded-12 border border-[#f59e0b55] bg-[#f59e0b14] px-4 py-3 text-14">
              The minimum order is <b>{money(settings.minOrder)}</b> (after discounts). Add {money(settings.minOrder - discounted)} more to check out.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-12 border border-[#f3c1c6] bg-accent-soft px-4 py-3 text-14 text-[#b3141f]">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending || !options.length || belowMinimum || !payment} className="btn cursor-pointer border-0 text-15 disabled:opacity-60">
            {pending ? "Placing order…" : `Place order · ${money(totals.total)}`}
          </button>
        </form>

        <OrderSummary
          totals={totals}
          promoPercent={promo?.percent}
          shippingLabel={chosen ? `Shipping · ${chosen.name}` : "Shipping"}
          taxLabel={taxExempt ? "Tax (exempt)" : `${tax?.name ?? "Tax"} (${tax?.rate ?? 0}%)`}
        >
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
