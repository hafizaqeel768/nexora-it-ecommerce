// Shipping zones and tax rates from the database (server-only), read once per request.
import { cache } from "react";
import { db } from "@/lib/db";
import type { TaxRateData, ZoneData } from "@/lib/shipping";

/** Zones with their active methods, specific zones first (by sort order), "rest of world" zones last. */
export const getShippingZones = cache(async (): Promise<ZoneData[]> => {
  const zones = await db.shippingZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { methods: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  return zones
    .map((z) => ({
      id: z.id,
      name: z.name,
      countries: z.countries,
      states: z.states,
      methods: z.methods.map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        price: Number(m.price),
        freeFrom: m.freeFrom == null ? null : Number(m.freeFrom),
        minSubtotal: m.minSubtotal == null ? null : Number(m.minSubtotal),
      })),
    }))
    .sort((a, b) => Number(a.countries.length === 0) - Number(b.countries.length === 0));
});

export const getTaxRates = cache(async (): Promise<TaxRateData[]> => {
  const rates = await db.taxRate.findMany({ orderBy: [{ country: "asc" }, { state: "asc" }] });
  return rates.map((r) => ({ name: r.name, country: r.country, state: r.state, rate: Number(r.rate), shipping: r.shipping }));
});
