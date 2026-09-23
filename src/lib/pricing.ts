// Pure pricing rules from the prototype (tierPrice / lineUnit). Safe for server and client.

export type Tier = { minQty: number; maxQty: number | null; multiplier: number };

/** Unit price for a quantity: base × multiplier of the matching bulk tier, rounded to cents. */
export function tierUnitPrice(base: number, tiers: Tier[], qty: number): number {
  let multiplier = 1;
  for (const t of tiers) {
    if (qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty)) multiplier = t.multiplier;
  }
  return Math.round(base * multiplier * 100) / 100;
}

/** Unit price including the selected variant's price delta. */
export const lineUnitPrice = (base: number, tiers: Tier[], qty: number, variantDelta = 0) =>
  Math.round((tierUnitPrice(base, tiers, qty) + variantDelta) * 100) / 100;

const cents = (n: number) => Math.round(n * 100) / 100;

export type CartTotals = { subtotal: number; discount: number; shipping: number; tax: number; total: number };

/**
 * The prototype's totals(), with Phase 11 rules: promo % off the subtotal, the shipping cost of the chosen
 * method, and tax on the discounted subtotal (plus shipping when the rate says so).
 */
export function cartTotals(
  lines: { unitPrice: number; quantity: number }[],
  promoPercent: number,
  rules: { shipping: number; taxPercent: number; taxShipping?: boolean },
): CartTotals {
  const subtotal = cents(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const discount = cents((subtotal * promoPercent) / 100);
  const shipping = subtotal ? cents(rules.shipping) : 0;
  const taxable = subtotal - discount + (rules.taxShipping ? shipping : 0);
  const tax = cents((taxable * rules.taxPercent) / 100);
  return { subtotal, discount, shipping, tax, total: cents(subtotal - discount + shipping + tax) };
}

/** Before an address is known (cart page, mini cart): no shipping or tax yet. */
export const NO_SHIPPING_OR_TAX = { shipping: 0, taxPercent: 0 } as const;
