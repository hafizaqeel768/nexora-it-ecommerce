import type { Tier } from "@/lib/pricing";

/** What a product card / product page hands to the cart. Prices are re-checked on the server at checkout. */
export type CartProduct = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;
  tiers: Tier[];
  variantId: string | null;
  variantName: string | null;
  variantDelta: number;
  /** Stock limit (null stock = untracked) */
  maxQty: number;
  available: boolean;
};

export type CartLine = CartProduct & { key: string; quantity: number };

export const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ""}`;
