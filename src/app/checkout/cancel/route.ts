import { NextResponse, type NextRequest } from "next/server";
import { cancelUnpaidOrder } from "@/lib/orders";

// Stripe's cancel_url: release the unpaid card order, then go back to checkout with the cart intact.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order");
  if (orderId) await cancelUnpaidOrder(orderId);
  // Build the redirect from the browser's Host header (inside Docker, req.url says 0.0.0.0).
  const origin = `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`;
  return NextResponse.redirect(new URL("/checkout?canceled=1", origin));
}
