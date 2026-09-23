// Store rules (the prototype's SET). Stored in StoreSettings and edited in /admin/settings;
// these defaults apply until the settings are first saved. Safe for server and client.
export type StoreRules = {
  /** Free shipping when the discounted subtotal reaches this amount (USD) */
  freeShippingFrom: number;
  /** Flat shipping fee below the threshold (USD) */
  shippingFee: number;
  /** Estimated sales tax, percent of the discounted subtotal */
  taxPercent: number;
  /** Admin low-stock alert at or below this many units */
  lowStockAt: number;
};

export const DEFAULT_STORE_RULES: StoreRules = { freeShippingFrom: 500, shippingFee: 25, taxPercent: 8, lowStockAt: 10 };
