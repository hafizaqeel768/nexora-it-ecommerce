import { money } from "@/lib/format";
import type { CartTotals } from "@/lib/pricing";
import { STORE } from "@/lib/store-settings";

// Totals block (the prototype's summary()).
export function OrderSummary({ totals, promoPercent, children }: { totals: CartTotals; promoPercent?: number; children?: React.ReactNode }) {
  const row = "flex justify-between py-[7px] text-14 text-muted";
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
        <span>Shipping</span>
        <span>{totals.shipping ? money(totals.shipping) : "Free"}</span>
      </div>
      <div className={row}>
        <span>Est. tax ({STORE.taxPercent}%)</span>
        <span>{money(totals.tax)}</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-line pt-3.5 text-18 font-extrabold text-ink">
        <span>Total</span>
        <span>{money(totals.total)}</span>
      </div>
      {children}
    </div>
  );
}
