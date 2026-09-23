// Order helpers (server-only, deliberately not server actions so they can't be called from the browser).
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { after } from "next/server";
import { db } from "@/lib/db";
import { deliverOrderEmail, queueOrderEmail } from "@/lib/order-emails";

type Tx = Prisma.TransactionClient;

/** A free NX-xxxxxx order number (the prototype's format); null after 5 collisions. */
export async function newOrderNumber(tx: Tx): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = `NX-${randomInt(100000, 1000000)}`;
    if (!(await tx.order.findUnique({ where: { number }, select: { id: true } }))) return number;
  }
  return null;
}

/** Puts an order's items back into stock (tracked products only). Call once, when the order is cancelled. */
export async function restockOrder(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, include: { product: { select: { stock: true } } } });
  for (const i of items) {
    if (i.productId && i.product?.stock != null) {
      await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
    }
  }
}

/** Cancels an unpaid card order and puts its reserved stock back. Safe to call more than once. */
export async function cancelUnpaidOrder(orderId: string) {
  await db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING", paymentStatus: "UNPAID", paymentMethod: "CREDIT_CARD" },
      data: { status: "CANCELLED" },
    });
    if (res.count === 1) await restockOrder(tx, orderId);
  });
}

/**
 * After Stripe redirects back: ask Stripe (never trust the URL) whether this order's session is paid,
 * mark the order paid and send the confirmation email. Idempotent.
 */
export async function confirmStripePayment(orderId: string, sessionId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { stripeSessionId: true, paymentStatus: true } });
  if (!order || order.paymentStatus === "PAID" || order.stripeSessionId !== sessionId) return;
  const { getStripe } = await import("@/lib/stripe");
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid" && session.metadata?.orderId === orderId) {
    const emailId = await db.$transaction(async (tx) => {
      const res = await tx.order.updateMany({ where: { id: orderId, paymentStatus: "UNPAID" }, data: { paymentStatus: "PAID" } });
      if (res.count !== 1) return null; // someone else confirmed it first
      const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { email: true } });
      return (await queueOrderEmail(tx, orderId, "CONFIRMATION", "PENDING", o.email)).id;
    });
    if (emailId) after(() => deliverOrderEmail(emailId));
  }
}

export function getOrder(id: string) {
  return db.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } } } });
}
