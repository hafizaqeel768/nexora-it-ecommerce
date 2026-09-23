import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/product/gallery";
import { ProductCard } from "@/components/product/product-card";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { RelatedRow } from "@/components/product/related-row";
import { Reviews } from "@/components/product/reviews";
import { getProduct, getRelated } from "@/lib/catalog";
import { categoryHref } from "@/lib/site-nav";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Product not found" };
  return { title: `${product.name}`, description: product.description?.slice(0, 160) ?? undefined };
}

// Product detail page (the prototype's #/product/:id).
export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const related = await getRelated(product);

  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        <nav aria-label="Breadcrumb" className="mb-[22px] text-13 text-muted">
          <Link href="/shop" className="text-accent">
            Shop
          </Link>
          {product.parent && (
            <>
              {" / "}
              <Link href={categoryHref(product.parent.slug)} className="text-accent">
                {product.parent.name}
              </Link>
            </>
          )}
          {" / "}
          <Link href={categoryHref(product.category.slug)} className="text-accent">
            {product.category.name}
          </Link>
          {" / "}
          {product.name}
        </nav>

        <div className="grid grid-cols-2 items-start gap-10 max-lg:grid-cols-1">
          <Gallery images={product.images} name={product.name} topCategorySlug={product.topCategorySlug} />
          <PurchasePanel
            productId={product.id}
            image={product.images[0] ?? null}
            slug={product.slug}
            name={product.name}
            brand={product.brand}
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            rating={product.rating}
            stock={product.stock}
            availability={product.availability}
            description={product.description}
            details={product.details}
            variants={product.variants}
            tiers={product.tiers}
          />
        </div>

        <Reviews reviews={product.reviews} />

        {related.length > 0 && (
          <RelatedRow>
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </RelatedRow>
        )}
      </div>
    </main>
  );
}
