import { money } from "@/lib/format";
import type { CartTotals } from "@/lib/pricing";

// Totals block (the prototype's summary()). Before an address is known (`atCheckout`), shipping and tax
// are shown as "calculated at checkout".
export function OrderSummary({
  totals,
  promoPercent,
  taxLabel,
  shippingLabel,
  atCheckout = false,
  children,
}: {
  totals: CartTotals;
  promoPercent?: number;
  /** e.g. "Tax (8.25%)" */
  taxLabel?: string;
  /** e.g. "Shipping · Standard" */
  shippingLabel?: string;
  atCheckout?: boolean;
  children?: React.ReactNode;
}) {
  const row = "flex justify-between gap-3 py-[7px] text-14 text-muted";
  return (
    <div className="sticky top-[90px] rounded-18 border border-line bg-surface p-[22px] shadow-[0_8px_28px_#0000000d] max-lg:static">
      <h3 className="mb-3 text-18 font-bold">Order summary</h3>
      <div className={row}>
        <span>Subtotal</span>
        <span>{money(totals.subtotal)}</span>
      </div>
      {totals.discount > 0 && (
        <div className={row}>
          <span>Promo ({promoPercent}%)</span>
          <span>−{money(totals.discount)}</span>
        </div>
      )}
      <div className={row}>
        <span className="min-w-0">{shippingLabel ?? "Shipping"}</span>
        <span className="flex-none">{atCheckout ? "At checkout" : totals.shipping ? money(totals.shipping) : "Free"}</span>
      </div>
      <div className={row}>
        <span>{taxLabel ?? "Tax"}</span>
        <span>{atCheckout ? "At checkout" : money(totals.tax)}</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-3.5 text-18 font-extrabold text-ink">
        <span>{atCheckout ? "Subtotal" : "Total"}</span>
        <span>{money(totals.total)}</span>
      </div>
      {atCheckout && <p className="mt-1.5 text-12 text-muted">Shipping and tax are calculated from your address at checkout.</p>}
      {children}
    </div>
  );
}
