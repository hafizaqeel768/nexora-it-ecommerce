import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { stripeEnabled } from "@/lib/stripe";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Checkout | Nexora IT" };

type Props = { searchParams: Promise<{ canceled?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const { canceled } = await searchParams;
  const viewer = await getViewer();
  // Signed-in customers start with their profile and saved address filled in.
  const prefill = viewer
    ? {
        name: viewer.name,
        email: viewer.email,
        phone: viewer.phone ?? "",
        line: viewer.addressLine ?? "",
        city: viewer.city ?? "",
        state: viewer.state ?? "",
        postalCode: viewer.postalCode ?? "",
        country: viewer.country ?? "",
      }
    : {};
  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        <CheckoutView cardEnabled={stripeEnabled} canceled={canceled === "1"} prefill={prefill} />
      </div>
    </main>
  );
}
