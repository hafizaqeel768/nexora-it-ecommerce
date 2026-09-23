"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/auth";
import { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { cartTotals, lineUnitPrice } from "@/lib/pricing";
import { deliverOrderEmail, queueOrderEmail } from "@/lib/order-emails";
import { cancelUnpaidOrder, newOrderNumber } from "@/lib/orders";
import { getConfig } from "@/lib/config";
import { countryName, isCountryCode, stateKey } from "@/lib/countries";
import { getShippingZones, getTaxRates } from "@/lib/shipping-data";
import { shippingOptions, taxRateFor } from "@/lib/shipping";
import { getStripe, stripeEnabled } from "@/lib/stripe";

// ---------- promo codes ----------

export async function applyCoupon(code: string): Promise<{ code: string; percent: number } | { error: string }> {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!c || !c.active) return { error: "Invalid promo code" };
  return { code: c.code, percent: c.percentOff };
}

// ---------- place order ----------

export type CheckoutInput = {
  lines: { productId: string; variantId: string | null; quantity: number }[];
  couponCode: string | null;
  contact: { name: string; email: string; phone: string };
  /** country: ISO 3166 code */
  address: { line: string; city: string; state: string; postalCode: string; country: string };
  shippingMethodId: string;
  payment: "card" | "purchase_order" | "bank_transfer";
  notes: string;
};

export type CheckoutResult = { redirect: string } | { error: string; fields?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const paymentMethods = {
  card: PaymentMethod.CREDIT_CARD,
  purchase_order: PaymentMethod.PURCHASE_ORDER,
  bank_transfer: PaymentMethod.BANK_TRANSFER,
} as const;
/** Checkout value → key in the Payments settings */
const paymentSetting = { card: "card", purchase_order: "purchaseOrder", bank_transfer: "bankTransfer" } as const;

class CheckoutError extends Error {}

const clean = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

type Tx = Prisma.TransactionClient;
type Contact = { name: string; email: string; phone: string };
type Address = { line: string; city: string; state: string; postalCode: string; country: string };

/**
 * Signed in: the order belongs to the account, and the first shipping address is saved to it.
 * Guest: the order is kept under a guest customer row for that email, but never under a registered
 * account (only its owner, signed in, can add orders to it).
 */
async function orderCustomerId(tx: Tx, accountId: string | null, contact: Contact, address: Address) {
  const account = accountId
    ? await tx.customer.findFirst({ where: { id: accountId, passwordHash: { not: null } }, select: { id: true, addressLine: true } })
    : null;
  if (account) {
    await tx.savedCart.deleteMany({ where: { customerId: account.id } }); // the cart became this order
    if (!account.addressLine) {
      await tx.customer.update({
        where: { id: account.id },
        data: { addressLine: address.line, city: address.city, state: address.state, postalCode: address.postalCode, country: address.country },
      });
    }
    return account.id;
  }

  const email = contact.email.toLowerCase();
  const row = await tx.customer.upsert({
    where: { email },
    create: {
      email,
      name: contact.name,
      phone: contact.phone || null,
      addressLine: address.line,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    },
    update: {},
    select: { id: true, passwordHash: true },
  });
  return row.passwordHash ? null : row.id;
}

/**
 * Creates the order from the cart. Prices, stock, coupon, shipping, tax and every checkout setting are
 * re-checked on the server; the browser only says which products, how many, the address and its choices.
 * Card payments then go to Stripe Checkout.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const [settings, payments, zones, taxRates] = await Promise.all([getConfig("checkout"), getConfig("payments"), getShippingZones(), getTaxRates()]);
  const accountId = (await auth())?.user?.id ?? null;
  const account = accountId ? await db.customer.findFirst({ where: { id: accountId, passwordHash: { not: null } }, select: { taxExempt: true } }) : null;
  if (!settings.guestCheckout && !account) return { error: "Please log in or create an account to check out." };

  const contact = { name: clean(input.contact?.name, 120), email: clean(input.contact?.email, 200), phone: clean(input.contact?.phone, 40) };
  const countryCode = clean(input.address?.country, 2).toUpperCase();
  const rawState = clean(input.address?.state, 100);
  const address = {
    line: clean(input.address?.line, 200),
    city: clean(input.address?.city, 100),
    state: countryCode === "US" ? stateKey("US", rawState) : rawState,
    postalCode: clean(input.address?.postalCode, 20),
    country: isCountryCode(countryCode) ? countryName(countryCode) : "",
  };
  const fields: Record<string, string> = {};
  if (!contact.name) fields.name = "Please enter your name.";
  if (!EMAIL.test(contact.email)) fields.email = "Please enter a valid email address.";
  if (settings.requirePhone && contact.phone.replace(/\D/g, "").length < 6) fields.phone = "Please enter a phone number.";
  if (!address.line) fields.line = "Please enter your address.";
  if (!address.city) fields.city = "Please enter your city.";
  if (!address.postalCode) fields.postalCode = "Please enter a ZIP / postal code.";
  if (!address.country) fields.country = "Please choose your country.";
  if (countryCode === "US" && !address.state) fields.state = "Please choose your state.";
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };

  const method = paymentMethods[input.payment];
  if (!method || !payments[paymentSetting[input.payment]].enabled) return { error: "Please choose a payment method." };
  if (method === PaymentMethod.CREDIT_CARD && !stripeEnabled) return { error: "Card payments are not available right now." };

  const lines = (input.lines ?? []).filter((l) => Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 10000);
  if (!lines.length) return { error: "Your cart is empty." };

  // Tax exemption only applies to signed-in accounts the store marked as exempt.
  const tax = account?.taxExempt ? null : taxRateFor(taxRates, countryCode, address.state);

  let order: { id: string; number: string; total: Prisma.Decimal; emailId: string | null };
  try {
    order = await db.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) }, status: "ACTIVE" },
        include: { priceTiers: true, variants: true },
      });

      const items = lines.map((l) => {
        const p = products.find((x) => x.id === l.productId);
        if (!p) throw new CheckoutError("A product in your cart is no longer available. Please review your cart.");
        const variant = l.variantId ? p.variants.find((v) => v.id === l.variantId) : null;
        if (l.variantId && !variant) throw new CheckoutError(`The selected option for ${p.name} is no longer available.`);
        if (p.availability === "OUT_OF_STOCK" || p.stock === 0) throw new CheckoutError(`${p.name} is out of stock.`);
        if (p.stock != null && p.stock < l.quantity) throw new CheckoutError(`Only ${p.stock} of ${p.name} left in stock.`);
        const tiers = p.priceTiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, multiplier: Number(t.multiplier) }));
        const unit = lineUnitPrice(Number(p.price), tiers, l.quantity, variant ? Number(variant.priceDelta) : 0);
        return {
          product: p,
          variant,
          quantity: l.quantity,
          unit,
          name: variant ? `${p.name} — ${variant.name}` : p.name,
        };
      });

      const coupon = input.couponCode
        ? await tx.coupon.findUnique({ where: { code: input.couponCode.trim().toUpperCase() } })
        : null;
      const percent = coupon?.active ? coupon.percentOff : 0;
      const priced = items.map((i) => ({ unitPrice: i.unit, quantity: i.quantity }));
      const goods = cartTotals(priced, percent, { shipping: 0, taxPercent: 0 });
      const discounted = goods.subtotal - goods.discount;
      if (settings.minOrder > 0 && discounted < settings.minOrder) {
        throw new CheckoutError(`The minimum order is ${money(settings.minOrder)} (after discounts).`);
      }
      const options = shippingOptions(zones, countryCode, address.state, discounted);
      if (!options.length) throw new CheckoutError(`Sorry, we don't ship to ${address.country}${address.state ? ` (${address.state})` : ""}.`);
      const shipping = options.find((o) => o.id === input.shippingMethodId);
      if (!shipping) throw new CheckoutError("Please choose a shipping method.");
      const totals = cartTotals(priced, percent, { shipping: shipping.cost, taxPercent: tax?.rate ?? 0, taxShipping: tax?.shipping });

      // Reserve stock for tracked products (released again if a card payment is cancelled).
      for (const i of items) {
        if (i.product.stock != null) {
          const res = await tx.product.updateMany({
            where: { id: i.product.id, stock: { gte: i.quantity } },
            data: { stock: { decrement: i.quantity } },
          });
          if (res.count !== 1) throw new CheckoutError(`Not enough stock for ${i.product.name}.`);
        }
      }

      const customerId = await orderCustomerId(tx, accountId, contact, address);

      const number = await newOrderNumber(tx);
      if (!number) throw new CheckoutError("Could not create the order, please try again.");
      const created = await tx.order.create({
        data: {
          number,
          customerId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone || null,
          addressLine: address.line,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          countryCode,
          shippingMethod: shipping.name,
          taxRate: tax?.rate ?? 0,
          paymentMethod: method,
          couponCode: percent ? coupon!.code : null,
          subtotal: totals.subtotal.toFixed(2),
          discount: totals.discount.toFixed(2),
          shippingFee: totals.shipping.toFixed(2),
          tax: totals.tax.toFixed(2),
          total: totals.total.toFixed(2),
          notes: clean(input.notes, 2000) || null,
          items: {
            create: items.map((i) => ({
              productId: i.product.id,
              variantId: i.variant?.id ?? null,
              name: i.name,
              sku: i.product.sku,
              unitPrice: i.unit.toFixed(2),
              quantity: i.quantity,
              lineTotal: (i.unit * i.quantity).toFixed(2),
            })),
          },
        },
        select: { id: true, number: true, total: true },
      });
      // Card orders get their confirmation once Stripe reports the payment (src/lib/orders.ts).
      const email = method !== PaymentMethod.CREDIT_CARD ? await queueOrderEmail(tx, created.id, "CONFIRMATION", "PENDING", contact.email) : null;
      return { ...created, emailId: email?.id ?? null };
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    throw e;
  }

  if (order.emailId) {
    const emailId = order.emailId;
    after(() => deliverOrderEmail(emailId));
  }
  if (method !== PaymentMethod.CREDIT_CARD) return { redirect: `/order/${order.id}` };

  // Card: hand off to Stripe Checkout for the exact server-computed total.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: contact.email,
      client_reference_id: order.id,
      metadata: { orderId: order.id, orderNumber: order.number },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(order.total) * 100),
            product_data: { name: `${(await getConfig("store")).name} order ${order.number}`, description: `${lines.length} item${lines.length === 1 ? "" : "s"} incl. shipping and tax` },
          },
        },
      ],
      success_url: `${origin}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel?order=${order.id}`,
    });
    await db.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
    return { redirect: session.url! };
  } catch (e) {
    await cancelUnpaidOrder(order.id);
    console.error("Stripe Checkout session failed", e);
    return { error: "Could not start the card payment. Please try again or choose another payment method." };
  }
}
