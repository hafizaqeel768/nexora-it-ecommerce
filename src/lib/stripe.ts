// Stripe (server-only). Card payments use hosted Stripe Checkout, so card data never touches this app.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";

/** Card payments are available only with a Stripe *test* key outside production. */
export const stripeEnabled = key.startsWith("sk_test_") || (process.env.NODE_ENV === "production" && key.startsWith("sk_live_"));

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeEnabled) throw new Error("Stripe is not configured (set a sk_test_ key in STRIPE_SECRET_KEY).");
  client ??= new Stripe(key);
  return client;
}
