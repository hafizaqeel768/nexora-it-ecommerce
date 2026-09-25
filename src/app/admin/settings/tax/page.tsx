import Link from "next/link";
import { deleteTaxRate, saveTaxRate } from "@/app/actions/settings";
import { Field } from "@/components/account/field";
import { ActionForm, ConfirmButton } from "@/components/admin/action-form";
import { card, CheckField, SectionTitle, select } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { COUNTRIES, countryName } from "@/lib/countries";
import { db } from "@/lib/db";

export const metadata = { title: "Tax" };

const label = "grid gap-1.5 text-13 text-muted";

type Rate = { id: string; name: string; country: string; state: string; rate: string; shipping: boolean };

function RateFields({ r }: { r?: Rate }) {
  return (
    <>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        <Field label="Name (shown at checkout)" name="name" placeholder="Texas sales tax" defaultValue={r?.name} />
        <label className={label}>
          <span>Country</span>
          <select name="country" defaultValue={r?.country === "*" ? "" : (r?.country ?? "")} className={`${select} w-full py-3`}>
            <option value="">All countries (fallback)</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="State (optional)" name="state" placeholder="TX" defaultValue={r?.state} />
        <Field label="Rate (%)" name="rate" type="number" min="0" max="50" step="0.001" defaultValue={r?.rate} />
      </div>
      <CheckField name="shipping" label="Also charge this tax on shipping" defaultChecked={r?.shipping} />
    </>
  );
}

// Settings → Tax: rates by country/state. Most specific match wins; tax-exempt customers pay none.
export default async function TaxSettings() {
  const admin = await requireAdminPage("/admin/settings/tax", "settings.view");
  const ro = !can(admin, "settings.edit");
  const [rates, exempt] = await Promise.all([
    db.taxRate.findMany({ orderBy: [{ country: "asc" }, { state: "asc" }] }),
    db.customer.count({ where: { taxExempt: true } }),
  ]);
  const place = (r: { country: string; state: string }) => (r.country === "*" ? "All countries" : `${countryName(r.country)}${r.state ? ` · ${r.state}` : ""}`);

  return (
    <div className="grid gap-4">
      <p className="text-14 text-muted">
        For each address the most specific rate is used: <b>country + state</b>, then <b>country</b>, then <b>All countries</b>. Tax is charged on
        the order after discounts. Without any matching rate, no tax is charged. <b>{exempt}</b> customer{exempt === 1 ? " is" : "s are"} tax-exempt
        (set per customer in{" "}
        <Link href="/admin/customers" className="font-bold text-accent">
          Customers
        </Link>
        ).
      </p>
      <div className={card}>
        <SectionTitle>Tax rates</SectionTitle>
        <div className="grid gap-2">
          {rates.length === 0 && <p className="text-13 text-muted">No tax rates: no tax is charged anywhere.</p>}
          {rates.map((r) => (
            <details key={r.id} className="rounded-12 border border-line bg-[#fafafa]">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-14">
                <b>{r.name}</b>
                <span className="text-muted">{place(r)}</span>
                <b>{Number(r.rate)}%</b>
                {r.shipping && <span className="text-12 text-muted">incl. shipping</span>}
                <span className="ml-auto text-13 font-bold text-accent">Edit</span>
              </summary>
              <div className="border-t border-line p-4">
                <ActionForm readOnly={ro} action={saveTaxRate} submitLabel="Save rate">
                  <RateFields r={{ id: r.id, name: r.name, country: r.country, state: r.state, rate: r.rate.toString(), shipping: r.shipping }} />
                </ActionForm>
                <div className="mt-3">
                  {!ro && <ConfirmButton action={deleteTaxRate.bind(null, r.id)} confirmText={`Delete the tax rate “${r.name}”?`} />}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
      <div className={card}>
        <SectionTitle hint="E.g. United States · TX · 8.25 %.">Add a tax rate</SectionTitle>
        <ActionForm readOnly={ro} action={saveTaxRate} submitLabel="Add rate" resetOnSuccess>
          <RateFields />
        </ActionForm>
      </div>
    </div>
  );
}
