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

/** The prototype's totals(): promo on the subtotal, free shipping from a threshold, tax on the discounted subtotal. */
export function cartTotals(
  lines: { unitPrice: number; quantity: number }[],
  promoPercent: number,
  rules: { freeShippingFrom: number; shippingFee: number; taxPercent: number },
): CartTotals {
  const subtotal = cents(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const discount = cents((subtotal * promoPercent) / 100);
  const shipping = !subtotal || subtotal - discount >= rules.freeShippingFrom ? 0 : rules.shippingFee;
  const tax = cents(((subtotal - discount) * rules.taxPercent) / 100);
  return { subtotal, discount, shipping, tax, total: cents(subtotal - discount + shipping + tax) };
}
