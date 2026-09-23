import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "Checkout | Nexora IT" };

type Props = { searchParams: Promise<{ canceled?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const { canceled } = await searchParams;
  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        <CheckoutView cardEnabled={stripeEnabled} canceled={canceled === "1"} />
      </div>
    </main>
  );
}
