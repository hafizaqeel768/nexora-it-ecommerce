import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";
import { redirect } from "next/navigation";
import { CheckoutView, type CheckoutPayment } from "@/components/checkout/checkout-view";
import { getConfig } from "@/lib/config";
import { COUNTRIES, isCountryCode } from "@/lib/countries";
import { getShippingZones, getTaxRates } from "@/lib/shipping-data";
import { stripeEnabled } from "@/lib/stripe";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Checkout", robots: NO_INDEX };

type Props = { searchParams: Promise<{ canceled?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const { canceled } = await searchParams;
  const [viewer, settings, payments, zones, taxRates] = await Promise.all([
    getViewer(),
    getConfig("checkout"),
    getConfig("payments"),
    getShippingZones(),
    getTaxRates(),
  ]);
  if (!settings.guestCheckout && !viewer) redirect("/login?next=%2Fcheckout");

  // Saved addresses store the country name; checkout works with the ISO code.
  const savedCountry = viewer?.country ? (COUNTRIES.find((c) => c.name === viewer.country)?.code ?? (isCountryCode(viewer.country) ? viewer.country : "")) : "";
  const prefill = viewer
    ? {
        name: viewer.name,
        email: viewer.email,
        phone: viewer.phone ?? "",
        line: viewer.addressLine ?? "",
        city: viewer.city ?? "",
        state: viewer.state ?? "",
        postalCode: viewer.postalCode ?? "",
        country: savedCountry || settings.defaultCountry,
      }
    : { country: settings.defaultCountry };

  const options: CheckoutPayment[] = [
    { value: "card" as const, ...payments.card, available: stripeEnabled },
    { value: "purchase_order" as const, ...payments.purchaseOrder, available: true },
    { value: "bank_transfer" as const, ...payments.bankTransfer, available: true },
  ]
    .filter((p) => p.enabled)
    .map(({ value, label, instructions, available }) => ({ value, label, instructions, available }));

  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        <CheckoutView
          canceled={canceled === "1"}
          prefill={prefill}
          zones={zones}
          taxRates={taxRates}
          payments={options}
          settings={{ minOrder: settings.minOrder, requirePhone: settings.requirePhone, showNotes: settings.showNotes }}
          taxExempt={!!viewer?.taxExempt}
        />
      </div>
    </main>
  );
}
