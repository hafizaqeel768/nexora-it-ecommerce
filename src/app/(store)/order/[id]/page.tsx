import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/cart/order-summary";
import { ClearCart } from "@/components/checkout/clear-cart";
import { money } from "@/lib/format";
import { confirmStripePayment, getOrder } from "@/lib/orders";

export const metadata: Metadata = { title: "Order confirmed | Nexora IT" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ session_id?: string }> };

const paymentLabel = { CREDIT_CARD: "Credit card", PURCHASE_ORDER: "Purchase order", BANK_TRANSFER: "Bank transfer" } as const;

// Order confirmation (the prototype's orderPage()). The id is an unguessable cuid.
export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { session_id } = await searchParams;
  if (session_id) await confirmStripePayment(id, session_id);
  const order = await getOrder(id);
  if (!order) notFound();

  const n = (d: { toString(): string }) => Number(d.toString());
  const paid = order.paymentStatus === "PAID";
  const awaitingCard = order.paymentMethod === "CREDIT_CARD" && !paid;
  const totals = { subtotal: n(order.subtotal), discount: n(order.discount), shipping: n(order.shippingFee), tax: n(order.tax), total: n(order.total) };
  const promoPercent = totals.subtotal ? Math.round((totals.discount / totals.subtotal) * 100) : 0;
  // The rate that applied to this order (settings may have changed since).
  const taxed = totals.subtotal - totals.discount;
  const taxPercent = taxed ? Math.round((totals.tax / taxed) * 1000) / 10 : 0;

  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      {/* Card orders: clear the cart only once Stripe confirmed payment; other methods cleared at checkout. */}
      {(paid || !awaitingCard) && <ClearCart />}
      <div className="wrap">
        <div className="mx-auto max-w-[560px] text-center">
          <div className="mx-auto mb-5 grid size-[84px] animate-pop place-items-center rounded-full bg-accent text-[44px] text-white">
            {awaitingCard ? "…" : "✓"}
          </div>
          <h1 className="text-[clamp(26px,4vw,36px)] font-bold tracking-[-.8px]">
            {order.status === "CANCELLED" ? "Order cancelled" : `Thank you, ${order.name.split(" ")[0]}!`}
          </h1>
          <p className="section-sub mx-auto mt-2 mb-5">
            {order.status === "CANCELLED" ? (
              <>
                Order <b>{order.number}</b> was cancelled.
              </>
            ) : awaitingCard ? (
              <>
                We haven&apos;t received the card payment for order <b>{order.number}</b> yet.
              </>
            ) : (
              <>
                Your order <b>{order.number}</b> has been placed. We&apos;ll send a confirmation to {order.email}.
              </>
            )}
          </p>
          <div className="text-left">
            <OrderSummary totals={totals} promoPercent={promoPercent} taxPercent={taxPercent}>
              <div className="mt-3.5">
                {order.items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-3 py-[7px] text-14 text-muted">
                    <span className="min-w-0">
                      {i.name} × {i.quantity}
                    </span>
                    <span className="flex-none">{money(n(i.lineTotal))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-14 text-muted">
                <span>Payment</span>
                <span>
                  {paymentLabel[order.paymentMethod]} · {paid ? "Paid" : "Awaiting payment"}
                </span>
              </div>
            </OrderSummary>
          </div>
          <p className="mt-6">
            <Link href="/shop" className="btn">
              Continue shopping
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
