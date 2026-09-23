// Shipping zones/methods and tax rates (Phase 11). Pure functions, safe for server and client: the checkout
// shows live totals with them, and the server recomputes with the same functions when the order is placed.
import { stateKey } from "@/lib/countries";

export type MethodData = {
  id: string;
  name: string;
  kind: "FLAT" | "PICKUP";
  price: number;
  freeFrom: number | null;
  minSubtotal: number | null;
};
export type ZoneData = { id: string; name: string; countries: string[]; states: string[]; methods: MethodData[] };
export type TaxRateData = { name: string; country: string; state: string; rate: number; shipping: boolean };
export type ShippingOption = { id: string; name: string; kind: MethodData["kind"]; cost: number };

/** The zone for an address: first specific zone that matches (zones come sorted), else the "rest of world" zone. */
export function zoneFor(zones: ZoneData[], country: string, state: string): ZoneData | null {
  const st = stateKey(country, state);
  const specific = zones.find((z) => z.countries.includes(country) && (!z.states.length || z.states.includes(st)));
  return specific ?? zones.find((z) => z.countries.length === 0) ?? null;
}

/** Methods offered for an address and discounted subtotal, with their cost. Empty = we don't ship there. */
export function shippingOptions(zones: ZoneData[], country: string, state: string, subtotal: number): ShippingOption[] {
  const zone = country ? zoneFor(zones, country, state) : null;
  if (!zone) return [];
  return zone.methods
    .filter((m) => m.minSubtotal == null || subtotal >= m.minSubtotal)
    .map((m) => ({ id: m.id, name: m.name, kind: m.kind, cost: m.freeFrom != null && subtotal >= m.freeFrom ? 0 : m.price }));
}

/** Most specific rate: country + state, then country, then "*". */
export function taxRateFor(rates: TaxRateData[], country: string, state: string): TaxRateData | null {
  const st = stateKey(country, state);
  return (
    rates.find((r) => r.country === country && r.state && r.state === st) ??
    rates.find((r) => r.country === country && !r.state) ??
    rates.find((r) => r.country === "*") ??
    null
  );
}

/** Countries the store ships to; `all` when a "rest of world" zone exists. */
export function shipsTo(zones: ZoneData[]): { all: boolean; countries: string[] } {
  const withMethods = zones.filter((z) => z.methods.length);
  return {
    all: withMethods.some((z) => z.countries.length === 0),
    countries: [...new Set(withMethods.flatMap((z) => z.countries))],
  };
}

/** Lowest "free from" amount of the zone for a country, for the free-shipping hint. */
export function freeShippingFrom(zones: ZoneData[], country: string): number | null {
  const zone = zoneFor(zones, country, "");
  const amounts = (zone?.methods ?? []).map((m) => m.freeFrom).filter((n): n is number => n != null);
  return amounts.length ? Math.min(...amounts) : null;
}
