// Shipment carriers and their public tracking pages (Phase 13). Safe for server and client.
export const CARRIERS = [
  { value: "ups", label: "UPS", url: (n: string) => `https://www.ups.com/track?tracknum=${n}` },
  { value: "fedex", label: "FedEx", url: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { value: "usps", label: "USPS", url: (n: string) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { value: "dhl", label: "DHL", url: (n: string) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}` },
  { value: "other", label: "Other carrier", url: null },
] as const;

export type CarrierValue = (typeof CARRIERS)[number]["value"];

export const isCarrier = (v: string): v is CarrierValue => CARRIERS.some((c) => c.value === v);

/** "UPS · 1Z999…" and a link to the carrier's tracking page (none for "other"). */
export function trackingInfo(carrier: string | null, number: string | null) {
  if (!number) return null;
  const c = CARRIERS.find((x) => x.value === carrier) ?? CARRIERS[CARRIERS.length - 1];
  return { carrier: c.label, number, url: c.url ? c.url(encodeURIComponent(number)) : null };
}
