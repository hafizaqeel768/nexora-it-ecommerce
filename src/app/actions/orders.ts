"use server";

// Order operations (Phase 13): internal notes, tracking, refunds, editing items/prices and the address.
// Every action checks the admin role itself and records what it did in the order's activity (OrderNote).
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { AdminFormState } from "@/app/actions/admin";
import { assertAdmin } from "@/lib/admin";
import { countryName, isCountryCode, stateKey } from "@/lib/countries";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { logOrderEvent } from "@/lib/order-activity";
import { deliverOrderEmail, queueOrderEmail } from "@/lib/order-emails";
import { restockOrder } from "@/lib/orders";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { isCarrier } from "@/lib/tracking";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const flag = (form: FormData, key: string) => form.get(key) === "on";
const cents = (n: number) => Math.round(n * 100) / 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refresh(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/order/${orderId}`);
}

// ---------- notes ----------

export async function addOrderNote(orderId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("orders.edit");
  const body = text(form, "body", 2000);
  if (!body) return { error: "Write a note first.", fields: { body: "Write a note first." } };
  await db.orderNote.create({ data: { orderId, kind: "NOTE", body, authorName: admin.name } });
  refresh(orderId);
  return { ok: "Note added (only staff can see it)." };
}

// ---------- tracking ----------

export async function saveTracking(orderId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("orders.edit");
  const carrier = text(form, "trackingCarrier", 20);
  const number = text(form, "trackingNumber", 80);
  if (number && !isCarrier(carrier)) return { error: "Choose the carrier." };
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, email: true } });
  if (!order) return { error: "Order not found." };
  const notify = flag(form, "notify") && order.status === "SHIPPED" && !!number;
  const emailId = await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { trackingCarrier: number ? carrier : null, trackingNumber: number || null } });
    await logOrderEvent(tx, orderId, number ? `Tracking: ${carrier.toUpperCase()} ${number}` : "Tracking removed", admin.name);
    return notify ? (await queueOrderEmail(tx, orderId, "STATUS", "SHIPPED", order.email)).id : null;
  });
  if (emailId) after(() => deliverOrderEmail(emailId));
  refresh(orderId);
  return { ok: number ? `Tracking saved${notify ? `; the Shipped email with tracking goes to ${order.email}` : ""}.` : "Tracking removed." };
}

// ---------- refunds ----------

/**
 * Refunds (part of) a paid order. Card orders are refunded through Stripe; other methods are recorded as paid
 * back by hand. Optionally cancels the order and puts the items back in stock, and emails the customer.
 */
export async function refundOrder(orderId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("orders.refund");
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { number: true, email: true, status: true, paymentStatus: true, paymentMethod: true, stripeSessionId: true, total: true, refundedTotal: true },
  });
  if (!order) return { error: "Order not found." };
  if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") return { error: "Only paid orders can be refunded." };

  const remaining = cents(Number(order.total) - Number(order.refundedTotal));
  const amount = cents(Number(text(form, "amount", 20)));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount to refund.", fields: { amount: "Enter an amount." } };
  if (amount > remaining) return { error: `At most ${money(remaining)} can still be refunded.`, fields: { amount: "Too much." } };
  const reason = text(form, "reason", 300) || null;
  const cancel = flag(form, "cancel") && order.status !== "CANCELLED";
  const notify = flag(form, "notify");

  // Card: refund through Stripe first; only a successful refund is recorded.
  let stripeRefundId: string | null = null;
  const viaStripe = order.paymentMethod === "CREDIT_CARD" && !!order.stripeSessionId;
  if (viaStripe) {
    if (!stripeEnabled) return { error: "Stripe is not set up on this server, so the card can't be refunded here." };
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId!);
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!paymentIntent) return { error: "Stripe has no payment for this order." };
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntent, amount: Math.round(amount * 100), metadata: { orderId, orderNumber: order.number } },
        { idempotencyKey: `refund-${orderId}-${order.refundedTotal}-${Math.round(amount * 100)}` },
      );
      stripeRefundId = refund.id;
    } catch (e) {
      return { error: `Stripe refused the refund: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const full = amount >= remaining;
  const result = await db.$transaction(async (tx) => {
    // Only apply on top of the refunded total we checked (a second admin refunding at the same moment is refused).
    const res = await tx.order.updateMany({
      where: { id: orderId, refundedTotal: order.refundedTotal },
      data: {
        refundedTotal: { increment: amount },
        paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
        ...(cancel ? { status: "CANCELLED" as const } : {}),
      },
    });
    if (res.count !== 1) return null;
    if (cancel) await restockOrder(tx, orderId);
    const refund = await tx.refund.create({
      data: { orderId, amount, reason, method: viaStripe ? "STRIPE" : "MANUAL", stripeRefundId, restocked: cancel, createdBy: admin.name },
    });
    await logOrderEvent(
      tx,
      orderId,
      `Refunded ${money(amount)}${viaStripe ? " to the card (Stripe)" : " (paid back manually)"}${reason ? ` — ${reason}` : ""}${cancel ? "; order cancelled, items back in stock" : ""}`,
      admin.name,
    );
    const email = notify ? await queueOrderEmail(tx, orderId, "REFUND", cancel ? "CANCELLED" : order.status, order.email, refund.id) : null;
    return { emailId: email?.id ?? null };
  });
  if (!result) return { error: "The order changed meanwhile; please reload before refunding again." };
  if (result.emailId) {
    const id = result.emailId;
    after(() => deliverOrderEmail(id));
  }
  refresh(orderId);
  revalidatePath("/", "layout");
  return {
    ok: `${money(amount)} refunded${viaStripe ? " through Stripe" : ""}${full ? " (fully refunded)" : ""}${cancel ? "; order cancelled and items back in stock" : ""}${notify ? `; ${order.email} gets a refund email` : ""}.`,
  };
}

// ---------- editing ----------

const EDITABLE = ["PENDING", "PROCESSING"] as const;

export type EditLine = { id: string | null; productId: string | null; name: string; sku: string; unitPrice: number; quantity: number };
export type EditPayload = { lines: EditLine[]; shippingFee: number; discount: number; taxRate: number; taxShipping: boolean };

/**
 * Changes the items, prices, shipping, discount and tax of an open, unpaid order (e.g. to price a converted
 * quote). Card orders can't be edited (Stripe charged the original amount). Stock follows the quantity changes.
 */
export async function editOrderItems(orderId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("orders.edit");
  let p: EditPayload;
  try {
    p = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Could not read the changes; please reload." };
  }
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { error: "Order not found." };
  if (!(EDITABLE as readonly string[]).includes(order.status) || order.paymentStatus !== "UNPAID" || order.paymentMethod === "CREDIT_CARD") {
    return { error: "Only open (pending/processing), unpaid purchase-order or bank-transfer orders can be edited." };
  }

  const lines = (Array.isArray(p?.lines) ? p.lines : []).map((l) => ({
    id: typeof l.id === "string" && l.id ? l.id : null,
    productId: typeof l.productId === "string" && l.productId ? l.productId : null,
    name: String(l.name ?? "").trim().slice(0, 200),
    sku: String(l.sku ?? "").trim().slice(0, 60) || null,
    unitPrice: cents(Number(l.unitPrice)),
    quantity: Number(l.quantity),
  }));
  const shippingFee = cents(Number(p?.shippingFee));
  const discount = cents(Number(p?.discount));
  const taxRate = Math.round(Number(p?.taxRate) * 1000) / 1000;
  const errors: string[] = [];
  if (!lines.length) errors.push("An order needs at least one line (cancel it instead).");
  if (lines.length > 100) errors.push("At most 100 lines.");
  lines.forEach((l, i) => {
    if (!l.name) errors.push(`Line ${i + 1}: name is required.`);
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0 || l.unitPrice >= 1e7) errors.push(`Line ${i + 1}: price must be 0 or more.`);
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 100000) errors.push(`Line ${i + 1}: quantity must be a whole number from 1.`);
  });
  if (!Number.isFinite(shippingFee) || shippingFee < 0) errors.push("Shipping must be 0 or more.");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 50) errors.push("Tax rate must be 0–50 %.");
  const ownIds = new Set(order.items.map((i) => i.id));
  if (lines.some((l) => l.id && !ownIds.has(l.id))) return { error: "The order changed meanwhile; please reload." };
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean) as string[])];
  const products = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, stock: true } });
  if (products.length !== productIds.length) errors.push("A product on the order no longer exists; remove that line or make it a custom line.");
  const subtotal = cents(lines.reduce((s, l) => s + cents(l.unitPrice * l.quantity), 0));
  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) errors.push("Discount must be between 0 and the subtotal.");
  if (errors.length) return { error: errors.join(" ") };

  const tax = cents(((subtotal - discount + (p.taxShipping ? shippingFee : 0)) * taxRate) / 100);
  const total = cents(subtotal - discount + shippingFee + tax);

  // Stock: difference per tracked product between the old and the new quantities.
  const qty = (list: { productId: string | null; quantity: number }[]) =>
    list.reduce((m, l) => (l.productId ? m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity) : m), new Map<string, number>());
  const before = qty(order.items);
  const after_ = qty(lines);
  const diffs = [...new Set([...before.keys(), ...after_.keys()])].map((id) => ({ id, diff: (after_.get(id) ?? 0) - (before.get(id) ?? 0) })).filter((d) => d.diff);

  const failed = await db.$transaction(async (tx) => {
    for (const d of diffs) {
      const prod = await tx.product.findUnique({ where: { id: d.id }, select: { stock: true, name: true } });
      if (!prod || prod.stock == null) continue; // untracked (or deleted) products don't hold stock
      if (d.diff > 0) {
        const res = await tx.product.updateMany({ where: { id: d.id, stock: { gte: d.diff } }, data: { stock: { decrement: d.diff } } });
        if (res.count !== 1) return `Not enough stock for ${prod.name} (${prod.stock} left).`;
      } else {
        await tx.product.update({ where: { id: d.id }, data: { stock: { increment: -d.diff } } });
      }
    }
    const keep = lines.map((l) => l.id).filter(Boolean) as string[];
    await tx.orderItem.deleteMany({ where: { orderId, id: { notIn: keep } } });
    for (const l of lines) {
      const data = { name: l.name, sku: l.sku, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: cents(l.unitPrice * l.quantity) };
      if (l.id) await tx.orderItem.update({ where: { id: l.id }, data });
      else await tx.orderItem.create({ data: { ...data, orderId, productId: l.productId } });
    }
    await tx.order.update({ where: { id: orderId }, data: { subtotal, discount, shippingFee, tax, total, taxRate } });
    await logOrderEvent(tx, orderId, `Items edited: ${lines.length} line${lines.length === 1 ? "" : "s"}, total ${money(order.total)} → ${money(total)}`, admin.name);
    return null;
  });
  if (failed) return { error: failed };
  refresh(orderId);
  revalidatePath("/", "layout");
  return { ok: `Order updated: total ${money(total)}. Let the customer know (e.g. a status email or a note in your invoice).` };
}

/** Contact details and shipping address, until the order has shipped. */
export async function updateOrderAddress(orderId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin("orders.edit");
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return { error: "Order not found." };
  if (!["PENDING", "PROCESSING"].includes(order.status)) return { error: "The address can only be changed before the order ships." };
  const countryCode = text(form, "country", 2).toUpperCase();
  const data = {
    name: text(form, "name", 120),
    email: text(form, "email", 200),
    phone: text(form, "phone", 40) || null,
    addressLine: text(form, "line", 200),
    city: text(form, "city", 100),
    state: countryCode === "US" ? stateKey("US", text(form, "state", 100)) : text(form, "state", 100),
    postalCode: text(form, "postalCode", 20),
    country: isCountryCode(countryCode) ? countryName(countryCode) : "",
    countryCode,
  };
  const fields: Record<string, string> = {};
  if (!data.name) fields.name = "Name is required.";
  if (!EMAIL.test(data.email)) fields.email = "Email is not valid.";
  if (!data.addressLine) fields.line = "Address is required.";
  if (!data.city) fields.city = "City is required.";
  if (!data.country) fields.country = "Choose a country.";
  if (Object.keys(fields).length) return { error: `Please check: ${Object.values(fields).join(" ")}`, fields };
  await db.$transaction([db.order.update({ where: { id: orderId }, data }), logOrderEvent(db, orderId, "Customer details / shipping address changed", admin.name)]);
  refresh(orderId);
  return { ok: "Customer details and address saved. Shipping and tax were not recalculated; adjust them in “Edit items” if needed." };
}

/** Product search for "Edit items" → "Add product". */
export async function searchProductsForOrder(q: string) {
  await assertAdmin("orders.edit");
  const words = String(q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return [];
  const rows = await db.product.findMany({
    where: { AND: words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { sku: { contains: w, mode: "insensitive" as const } }] })) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 8,
    select: { id: true, name: true, sku: true, price: true, stock: true, status: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku ?? "", price: Number(r.price), stock: r.stock, draft: r.status === "DRAFT" }));
}
