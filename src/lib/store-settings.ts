// Store rules from the prototype's SET object. Admin-editable settings come in Phase 9.
export const STORE = {
  /** Free shipping when the discounted subtotal reaches this amount (USD) */
  freeShippingFrom: 500,
  /** Flat shipping fee below the threshold (USD) */
  shippingFee: 25,
  /** Estimated sales tax, percent of the discounted subtotal */
  taxPercent: 8,
} as const;
