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
  tierUnitPrice(base, tiers, qty) + variantDelta;
