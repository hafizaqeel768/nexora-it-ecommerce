import { saveCheckoutSettings } from "@/app/actions/settings";
import { Field } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { card, CheckField, SectionTitle, select } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { COUNTRIES } from "@/lib/countries";

export const metadata = { title: "Checkout & stock" };

export default async function CheckoutSettingsPage() {
  const admin = await requireAdminPage("/admin/settings/checkout", "settings.view");
  const ro = !can(admin, "settings.edit");
  const [c, inv] = await Promise.all([getConfig("checkout"), getConfig("inventory")]);
  return (
    <ActionForm readOnly={ro} action={saveCheckoutSettings} submitLabel="Save checkout & stock" className="grid gap-4">
      <div className={card}>
        <SectionTitle>Checkout</SectionTitle>
        <div className="grid gap-3.5">
          <CheckField name="guestCheckout" label="Allow guest checkout" hint="Off: customers must log in or register before checking out." defaultChecked={c.guestCheckout} />
          <CheckField name="requirePhone" label="Phone number required" defaultChecked={c.requirePhone} />
          <CheckField name="showNotes" label="Show the “Order notes” field" defaultChecked={c.showNotes} />
          <div className="grid grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            <Field label="Minimum order (USD, after discounts; 0 = none)" name="minOrder" type="number" min="0" step="0.01" defaultValue={String(c.minOrder)} />
            <label className="grid gap-1.5 text-13 text-muted">
              <span>Default country at checkout</span>
              <select name="defaultCountry" defaultValue={c.defaultCountry} className={`${select} w-full py-3`}>
                {COUNTRIES.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
      <div className={card}>
        <SectionTitle hint="Products at or below this stock show in red in Products and on the dashboard.">Stock</SectionTitle>
        <Field label="Low-stock alert at (units)" name="lowStockAt" type="number" min="0" step="1" defaultValue={String(inv.lowStockAt)} />
      </div>
    </ActionForm>
  );
}
