// Shop filter/sort definitions shared by server queries and client controls (no database access).

export const PAGE_SIZE = 24;

export const SORTS = {
  featured: "Sort: Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Top rated",
} as const;
export type SortKey = keyof typeof SORTS;

export type ShopParams = {
  category: string | null;
  q: string;
  brands: string[];
  min: number | null;
  max: number | null;
  rating: number;
  sale: boolean;
  sort: SortKey;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string) => (v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);

/** URL search params → validated filter state. Unknown values fall back to defaults. */
export function parseShopParams(sp: RawParams): ShopParams {
  const brand = sp.brand;
  const sort = one(sp.sort);
  const rating = Number(one(sp.rating));
  return {
    category: one(sp.category) || null,
    q: one(sp.q).trim().slice(0, 100),
    brands: (Array.isArray(brand) ? brand : brand ? [brand] : []).filter(Boolean).slice(0, 30),
    min: num(one(sp.min)),
    max: num(one(sp.max)),
    rating: rating === 4 || rating === 4.5 ? rating : 0,
    sale: one(sp.sale) === "1",
    sort: sort in SORTS ? (sort as SortKey) : "featured",
    page: Math.max(1, Math.floor(Number(one(sp.page)) || 1)),
  };
}

/** Filter state → /shop URL. */
export function shopHref(p: ShopParams) {
  const u = new URLSearchParams();
  if (p.q) u.set("q", p.q);
  if (p.category) u.set("category", p.category);
  p.brands.forEach((b) => u.append("brand", b));
  if (p.min != null) u.set("min", String(p.min));
  if (p.max != null) u.set("max", String(p.max));
  if (p.rating) u.set("rating", String(p.rating));
  if (p.sale) u.set("sale", "1");
  if (p.sort !== "featured") u.set("sort", p.sort);
  if (p.page > 1) u.set("page", String(p.page));
  const qs = u.toString();
  return qs ? `/shop?${qs}` : "/shop";
}
