import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard } from "@/components/product/product-card";
import { Pagination } from "@/components/shop/pagination";
import { ShopView } from "@/components/shop/shop-view";
import { getCategoryName, getShopResults, parseShopParams } from "@/lib/catalog";
import { shopHref } from "@/lib/catalog-shared";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { category } = parseShopParams(await searchParams);
  return { title: `${(await getCategoryName(category)) ?? "Shop"}` };
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
