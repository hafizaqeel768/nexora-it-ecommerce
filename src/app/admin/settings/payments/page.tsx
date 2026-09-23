import { savePayments } from "@/app/actions/settings";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { card, CheckField, SectionTitle } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { stripeEnabled } from "@/lib/stripe";

export const metadata = { title: "Payments" };

const label = "grid gap-1.5 text-13 text-muted";

// Settings → Payments: switch methods on/off, their names and customer instructions.
// The Stripe secret key stays in the server environment (.env), never in the database or this page.
export default async function PaymentSettingsPage() {
  await requireAdminPage("/admin/settings/payments");
  const p = await getConfig("payments");
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const stripe = stripeEnabled ? (key.startsWith("sk_live_") ? "Live mode" : "Test mode") : "Not set up";

  const methods = [
    { key: "card", title: "Credit card (Stripe)", hint: "Customers pay on Stripe's secure page; the order is marked paid automatically.", v: p.card },
    { key: "purchaseOrder", title: "Purchase order", hint: "For business customers: you invoice them and mark the order paid in Orders.", v: p.purchaseOrder },
    { key: "bankTransfer", title: "Bank transfer", hint: "Put your bank details in the instructions; they're shown after ordering and in the email.", v: p.bankTransfer },
  ] as const;

  return (
    <ActionForm action={savePayments} submitLabel="Save payment settings" className="grid gap-4">
      {methods.map((m) => (
        <div key={m.key} className={card}>
          <SectionTitle hint={m.hint}>{m.title}</SectionTitle>
          {m.key === "card" && (
            <p className={`mb-3 text-13 ${stripeEnabled ? "text-success" : "text-[#dc2626]"}`}>
              Stripe: <b>{stripe}</b>
              {!stripeEnabled && " — card payments stay unavailable until a Stripe key is added to the server settings (.env) by your developer."}
            </p>
          )}
          <div className="grid gap-3.5">
            <CheckField name={`${m.key}.enabled`} label="Offer at checkout" defaultChecked={m.v.enabled} />
            <Field label="Name at checkout" name={`${m.key}.label`} defaultValue={m.v.label} />
            <label className={label}>
              <span>Instructions for the customer {m.key === "bankTransfer" ? "(bank name, account, IBAN/routing, reference)" : ""}</span>
              <textarea name={`${m.key}.instructions`} rows={m.key === "bankTransfer" ? 5 : 2} defaultValue={m.v.instructions} className={fieldClass} />
            </label>
          </div>
        </div>
      ))}
    </ActionForm>
  );
}
