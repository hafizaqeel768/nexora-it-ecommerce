"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ShopResult } from "@/lib/catalog";
import { SORTS, shopHref, type ShopParams, type SortKey } from "@/lib/catalog-shared";

type Props = {
  params: ShopParams;
  facets: Pick<ShopResult, "categories" | "brands" | "allCount" | "total">;
  children: React.ReactNode;
};

const cleared: Omit<ShopParams, "sort"> = {
  category: null, q: "", brands: [], min: null, max: null, rating: 0, sale: false, page: 1,
};

// Shop sidebar, toolbar and active-filter chips (the prototype's shop()); results come from the server.
export function ShopView({ params, facets, children }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState(false);
  const [min, setMin] = useState(params.min?.toString() ?? "");
  const [max, setMax] = useState(params.max?.toString() ?? "");

  // Every filter change goes back to page 1.
  const go = (next: Partial<ShopParams>) => {
    startTransition(() => router.push(shopHref({ ...params, page: 1, ...next }), { scroll: false }));
  };

  // Keep the price inputs in sync when the URL changes (chips, clear all, back button).
  useEffect(() => {
    setMin(params.min?.toString() ?? "");
    setMax(params.max?.toString() ?? "");
  }, [params.min, params.max]);

  // Apply typed prices after a short pause, like the prototype's live input.
  useEffect(() => {
    const n = (v: string) => (v === "" ? null : Math.max(0, Number(v)));
    if (n(min) === params.min && n(max) === params.max) return;
    const t = setTimeout(() => go({ min: n(min), max: n(max) }), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const toggleBrand = (b: string) =>
    go({ brands: params.brands.includes(b) ? params.brands.filter((x) => x !== b) : [...params.brands, b] });

  const catName =
    facets.categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === params.category)?.name ?? null;

  const chips: { label: string; clear: Partial<ShopParams> }[] = [
    ...(params.q ? [{ label: `Search: “${params.q}”`, clear: { q: "" } }] : []),
    ...(catName ? [{ label: catName, clear: { category: null } }] : []),
    ...params.brands.map((b) => ({ label: b, clear: { brands: params.brands.filter((x) => x !== b) } })),
    ...(params.min != null || params.max != null
      ? [{ label: `$${params.min ?? 0} – ${params.max == null ? "any" : `$${params.max}`}`, clear: { min: null, max: null } }]
      : []),
    ...(params.rating ? [{ label: `${params.rating}★ & up`, clear: { rating: 0 } }] : []),
    ...(params.sale ? [{ label: "On sale", clear: { sale: false } }] : []),
  ];

  const group = "border-t border-line py-4";
  const groupTitle = "mb-2.5 text-12 font-bold tracking-[.09em] text-muted uppercase";
  const option = "flex cursor-pointer items-center gap-2.5 px-0.5 py-1.5 text-14";
  const check = "size-[17px] accent-accent";
  const catBtn = (active: boolean) =>
    `flex w-full cursor-pointer items-center justify-between rounded-10 px-3 py-[9px] text-left text-14 transition duration-150 ${
      active ? "bg-accent-soft font-bold text-accent" : "hover:bg-[#f3f4f6]"
    }`;

  return (
    <div className="mt-2 grid grid-cols-[270px_1fr] items-start gap-7 max-xl:grid-cols-1">
      {/* Sidebar (drawer on ≤900px) */}
      <aside
        id="shop-filters"
        className={`sticky top-[70px] max-h-[calc(100vh-90px)] overflow-auto rounded-18 border border-line bg-white p-5 [scrollbar-width:thin] max-xl:fixed max-xl:inset-y-0 max-xl:left-0 max-xl:z-[70] max-xl:max-h-none max-xl:w-[min(340px,90vw)] max-xl:rounded-none max-xl:rounded-r-18 max-xl:transition-transform max-xl:duration-300 ${
          drawer ? "" : "max-xl:-translate-x-[105%]"
        }`}
      >
        <div className="mb-2 flex items-center gap-3">
          <h3 className="flex-1 text-18 font-bold">Filters</h3>
          <button type="button" className="cursor-pointer text-13 font-semibold text-accent hover:underline" onClick={() => go(cleared)}>
            Clear all
          </button>
          <button type="button" aria-label="Close filters" className="hidden cursor-pointer px-2 py-1 text-18 max-xl:block" onClick={() => setDrawer(false)}>
            ✕
          </button>
        </div>

        <div className={group}>
          <h4 className={groupTitle}>Category</h4>
          <button type="button" className={catBtn(!params.category)} onClick={() => go({ category: null })}>
            <span>All</span>
            <em className="text-12 text-muted not-italic">{facets.allCount}</em>
          </button>
          {facets.categories.map((c) => (
            <div key={c.slug}>
              <button type="button" className={catBtn(params.category === c.slug)} onClick={() => go({ category: c.slug })}>
                <span>{c.name}</span>
                <em className="text-12 text-muted not-italic">{c.count}</em>
              </button>
              {c.children.map((ch) => (
                <button
                  key={ch.slug}
                  type="button"
                  className={`${catBtn(params.category === ch.slug)} pl-6 text-13`}
                  onClick={() => go({ category: ch.slug })}
                >
                  <span>{ch.name}</span>
                  <em className="text-12 text-muted not-italic">{ch.count}</em>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className={group}>
          <h4 className={groupTitle}>Brand</h4>
          {facets.brands.map((b) => (
            <label key={b.name} className={option}>
              <input type="checkbox" className={check} checked={params.brands.includes(b.name)} onChange={() => toggleBrand(b.name)} />
              <span>{b.name}</span>
              <em className="ml-auto text-12 text-muted not-italic">{b.count}</em>
            </label>
          ))}
        </div>

        <div className={group}>
          <h4 className={groupTitle}>Price (USD)</h4>
          <div className="flex items-center gap-2 text-muted">
            <input
              className="w-full min-w-0 rounded-12 border border-line bg-surface px-3 py-2.5 text-14 text-ink outline-none focus:border-accent"
              type="number" min={0} placeholder="Min" aria-label="Minimum price" value={min} onChange={(e) => setMin(e.target.value)}
            />
            <span>–</span>
            <input
              className="w-full min-w-0 rounded-12 border border-line bg-surface px-3 py-2.5 text-14 text-ink outline-none focus:border-accent"
              type="number" min={0} placeholder="Max" aria-label="Maximum price" value={max} onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </div>

        <div className={group}>
          <h4 className={groupTitle}>Rating</h4>
          {([[0, "Any rating"], [4, "4★ & up"], [4.5, "4.5★ & up"]] as const).map(([v, label]) => (
            <label key={v} className={option}>
              <input type="radio" name="rating" className={check} checked={params.rating === v} onChange={() => go({ rating: v })} />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className={group}>
          <h4 className={groupTitle}>Offers</h4>
          <label className={option}>
            <input type="checkbox" className={check} checked={params.sale} onChange={(e) => go({ sale: e.target.checked })} />
            <span>On sale</span>
          </label>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-[65] bg-[#000a] transition-opacity duration-300 xl:hidden ${drawer ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setDrawer(false)}
        aria-hidden="true"
      />

      {/* Results */}
      <div>
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="hidden cursor-pointer items-center gap-2 rounded-pill border border-line bg-white px-[18px] py-2.5 text-14 font-semibold text-ink max-xl:inline-flex"
            aria-controls="shop-filters"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            ☰ Filters
          </button>
          <span className="flex-1 text-14 text-muted">
            <b className="text-ink">{facets.total}</b> product{facets.total === 1 ? "" : "s"}
          </span>
          <select
            aria-label="Sort products"
            className="cursor-pointer rounded-pill border border-line bg-white px-[18px] py-2.5 text-14 text-ink outline-none focus:border-accent max-md:ml-auto"
            value={params.sort}
            onChange={(e) => go({ sort: e.target.value as SortKey })}
          >
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {chips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => go(c.clear)}
                className="cursor-pointer rounded-pill border border-[#f3c1c6] bg-accent-soft py-1.5 pr-2 pl-3.5 text-13 font-semibold text-[#b3141f] transition hover:border-accent hover:bg-accent hover:text-white"
              >
                {c.label} <b className="ml-1.5 text-11">✕</b>
              </button>
            ))}
          </div>
        )}

        <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
          {facets.total > 0 ? (
            children
          ) : (
            <div className="rounded-18 border border-dashed border-line bg-white px-5 py-[60px] text-center">
              <div className="text-42">🔎</div>
              <h3 className="my-2 text-17 font-bold">No products found</h3>
              <p className="mb-[18px] text-muted">Try removing a filter or searching for something else.</p>
              <button type="button" className="btn cursor-pointer border-0" onClick={() => go(cleared)}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
