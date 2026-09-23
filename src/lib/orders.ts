// Order helpers (server-only, deliberately not server actions so they can't be called from the browser).
import { db } from "@/lib/db";

/** Cancels an unpaid card order and puts its reserved stock back. Safe to call more than once. */
export async function cancelUnpaidOrder(orderId: string) {
  await db.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING", paymentStatus: "UNPAID", paymentMethod: "CREDIT_CARD" },
      data: { status: "CANCELLED" },
    });
    if (res.count !== 1) return;
    const items = await tx.orderItem.findMany({ where: { orderId }, include: { product: { select: { stock: true } } } });
    for (const i of items) {
      if (i.productId && i.product?.stock != null) {
        await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
      }
    }
  });
}

/**
 * After Stripe redirects back: ask Stripe (never trust the URL) whether this order's session is paid,
 * and mark the order paid. Idempotent.
 */
export async function confirmStripePayment(orderId: string, sessionId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { stripeSessionId: true, paymentStatus: true } });
  if (!order || order.paymentStatus === "PAID" || order.stripeSessionId !== sessionId) return;
  const { getStripe } = await import("@/lib/stripe");
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid" && session.metadata?.orderId === orderId) {
    await db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
  }
}

export function getOrder(id: string) {
  return db.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } } } });
}
