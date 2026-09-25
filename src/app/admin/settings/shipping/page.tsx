import { deleteShippingMethod, deleteShippingZone, saveShippingMethod, saveShippingZone } from "@/app/actions/settings";
import { Field } from "@/components/account/field";
import { ActionForm, ConfirmButton } from "@/components/admin/action-form";
import { CountryPicker } from "@/components/admin/country-picker";
import { card, CheckField, SectionTitle, select } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export const metadata = { title: "Shipping" };

const label = "grid gap-1.5 text-13 text-muted";

type Method = { id: string; name: string; kind: "FLAT" | "PICKUP"; price: string; freeFrom: string; minSubtotal: string; active: boolean; sortOrder: number };

function MethodFields({ zoneId, m }: { zoneId: string; m?: Method }) {
  return (
    <>
      <input type="hidden" name="zoneId" value={zoneId} />
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 max-sm:grid-cols-1">
        <Field label="Name shown at checkout" name="name" placeholder="Standard (3–5 business days)" defaultValue={m?.name} />
        <label className={label}>
          <span>Type</span>
          <select name="kind" defaultValue={m?.kind ?? "FLAT"} className={`${select} w-full py-3`}>
            <option value="FLAT">Flat rate</option>
            <option value="PICKUP">Local pickup</option>
          </select>
        </label>
        <Field label="Price (USD)" name="price" type="number" min="0" step="0.01" defaultValue={m?.price ?? "0"} />
        <Field label="Free from order of (optional)" name="freeFrom" type="number" min="0" step="0.01" defaultValue={m?.freeFrom} />
        <Field label="Only offered from (optional)" name="minSubtotal" type="number" min="0" step="0.01" defaultValue={m?.minSubtotal} />
        <Field label="Order" name="sortOrder" type="number" step="1" defaultValue={String(m?.sortOrder ?? 0)} />
      </div>
      <CheckField name="active" label="Offered at checkout" defaultChecked={m?.active ?? true} />
    </>
  );
}

// Settings → Shipping: zones (where) and their methods (how much). The first matching zone wins.
export default async function ShippingSettings() {
  const admin = await requireAdminPage("/admin/settings/shipping", "settings.view");
  const ro = !can(admin, "settings.edit");
  const zones = await db.shippingZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { methods: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  const specificFirst = [...zones].sort((a, b) => Number(a.countries.length === 0) - Number(b.countries.length === 0));

  return (
    <div className="grid gap-4">
      <p className="text-14 text-muted">
        A customer&apos;s address is matched to the <b>first zone</b> that lists its country (and state, if the zone has states). A zone without
        countries covers <b>the rest of the world</b>. Addresses that match no zone can&apos;t check out. Amounts are in USD and apply to the
        order after discounts.
      </p>

      {specificFirst.map((z) => {
        const where = z.countries.length ? z.countries.map(countryName).join(", ") + (z.states.length ? ` · states: ${z.states.join(", ")}` : "") : "Rest of the world";
        return (
          <div key={z.id} className={card}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 className="text-18 font-bold">{z.name}</h3>
              <span className="text-13 text-muted">{where}</span>
              <span className="ml-auto">
                {!ro && <ConfirmButton action={deleteShippingZone.bind(null, z.id)} confirmText={`Delete the zone “${z.name}” and its shipping methods?`} label="Delete zone" />}
              </span>
            </div>

            <div className="grid gap-2">
              {z.methods.length === 0 && <p className="text-13 text-[#dc2626]">No methods yet: customers in this zone can&apos;t check out.</p>}
              {z.methods.map((m) => (
                <details key={m.id} className="rounded-12 border border-line bg-[#fafafa]">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-14">
                    <b>{m.name}</b>
                    <span className="text-muted">
                      {m.kind === "PICKUP" ? "Local pickup · " : ""}
                      {Number(m.price) ? money(m.price) : "Free"}
                      {m.freeFrom != null && ` · free from ${money(m.freeFrom)}`}
                      {m.minSubtotal != null && ` · only from ${money(m.minSubtotal)}`}
                    </span>
                    {!m.active && <span className="rounded-pill bg-[#6b72801f] px-2 py-0.5 text-12 font-bold text-[#6b7280]">Off</span>}
                    <span className="ml-auto text-13 font-bold text-accent">Edit</span>
                  </summary>
                  <div className="border-t border-line p-4">
                    <ActionForm readOnly={ro} action={saveShippingMethod} submitLabel="Save method">
                      <MethodFields
                        zoneId={z.id}
                        m={{
                          id: m.id,
                          name: m.name,
                          kind: m.kind,
                          price: m.price.toString(),
                          freeFrom: m.freeFrom?.toString() ?? "",
                          minSubtotal: m.minSubtotal?.toString() ?? "",
                          active: m.active,
                          sortOrder: m.sortOrder,
                        }}
                      />
                    </ActionForm>
                    <div className="mt-3">
                      {!ro && <ConfirmButton action={deleteShippingMethod.bind(null, m.id)} confirmText={`Delete “${m.name}”?`} label="Delete method" />}
                    </div>
                  </div>
                </details>
              ))}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-13 font-bold text-accent">+ Add a shipping method</summary>
              <div className="mt-3">
                <ActionForm readOnly={ro} action={saveShippingMethod} submitLabel="Add method" resetOnSuccess>
                  <MethodFields zoneId={z.id} />
                </ActionForm>
              </div>
            </details>

            <details className="mt-3">
              <summary className="cursor-pointer text-13 font-bold text-muted">Edit zone (name, countries, states)</summary>
              <div className="mt-3">
                <ActionForm readOnly={ro} action={saveShippingZone} submitLabel="Save zone">
                  <ZoneFields zone={z} />
                </ActionForm>
              </div>
            </details>
          </div>
        );
      })}

      <div className={card}>
        <SectionTitle hint="E.g. “Texas” (United States + state TX) for local rates, or “Canada” for international shipping.">Add a shipping zone</SectionTitle>
        <ActionForm readOnly={ro} action={saveShippingZone} submitLabel="Add zone" resetOnSuccess>
          <ZoneFields />
        </ActionForm>
      </div>
    </div>
  );
}

function ZoneFields({ zone }: { zone?: { id: string; name: string; countries: string[]; states: string[]; sortOrder: number } }) {
  return (
    <>
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <div className="grid grid-cols-[2fr_1fr] gap-3 max-sm:grid-cols-1">
        <Field label="Zone name" name="name" placeholder="United States" defaultValue={zone?.name} />
        <Field label="Order (lower first)" name="sortOrder" type="number" step="1" defaultValue={String(zone?.sortOrder ?? 0)} />
      </div>
      <div className={label}>
        <span>Countries</span>
        <CountryPicker key={zone?.countries.join(",")} initial={zone?.countries ?? []} />
      </div>
      <Field label="States (optional, only with one country; comma-separated codes, e.g. TX, OK)" name="states" defaultValue={zone?.states.join(", ")} />
    </>
  );
}
