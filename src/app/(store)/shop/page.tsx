import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard } from "@/components/product/product-card";
import { Pagination } from "@/components/shop/pagination";
import { ShopView } from "@/components/shop/shop-view";
import { getCategoryMeta, getShopResults, parseShopParams } from "@/lib/catalog";
import { shopHref } from "@/lib/catalog-shared";
import { getConfig } from "@/lib/config";
import { metaText } from "@/lib/seo";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// One indexable page per category (and its numbered pages); searches, filters and sort orders are "noindex",
// so search engines don't collect thousands of near-identical listing URLs.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = parseShopParams(await searchParams);
  const [cat, store] = await Promise.all([getCategoryMeta(p.category), getConfig("store")]);
  const name = cat?.name ?? "Shop";
  const title = cat?.seoTitle || name;
  const description = metaText(cat?.seoDescription || cat?.description || `Shop ${cat ? cat.name.toLowerCase() : "business IT hardware"} at ${store.name}: prices, stock, bulk pricing and quotes.`);
  const filtered = !!(p.q || p.brands.length || p.min != null || p.max != null || p.rating || p.sale || p.sort !== "featured");
  const canonical = shopHref({ ...p, q: "", brands: [], min: null, max: null, rating: 0, sale: false, sort: "featured", category: cat ? p.category : null });
  return {
    title,
    description,
    alternates: { canonical },
    robots: filtered || (p.category && !cat) ? { index: false, follow: true } : undefined,
    openGraph: { siteName: store.name, type: "website", url: canonical, title, description, images: cat?.image ? [cat.image] : undefined },
  };
}

// Catalog listing (the prototype's #/shop). Filters live in the URL; results come from Postgres.
export default async function ShopPage({ searchParams }: Props) {
  const params = parseShopParams(await searchParams);
  const result = await getShopResults(params);
  if (params.page > result.pages) redirect(shopHref({ ...params, page: result.pages }));

  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="mb-[22px] text-13 text-muted">
          <Link href="/" className="text-accent">
            Home
          </Link>{" "}
          /{" "}
          {result.categoryName ? (
            <>
              <Link href="/shop" className="text-accent">
                Shop
              </Link>{" "}
              / {result.categoryName}
            </>
          ) : (
            "Shop"
          )}
        </nav>
        <h1 className="mt-1.5 mb-2.5 text-[clamp(26px,4vw,36px)] leading-[1.15] font-bold tracking-[-.8px]">
          {result.categoryName ?? "IT Hardware Catalog"}
        </h1>
        <p className="section-sub">Filter by category, brand, price and rating.</p>

        <ShopView params={params} facets={result}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(205px,1fr))] gap-[18px]">
            {result.products.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
          <Pagination params={params} pages={result.pages} />
        </ShopView>
      </div>
    </main>
  );
}
