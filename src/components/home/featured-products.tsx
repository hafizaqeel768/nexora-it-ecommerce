import { ProductCard } from "@/components/product/product-card";
import type { ProductCardData } from "@/lib/products";

export function FeaturedProducts({ products }: { products: ProductCardData[] }) {
  if (!products.length) return null;
  return (
    <section id="featured" className="section-white">
      <div className="wrap">
        <h2 className="section-title">Featured products</h2>
        <p className="section-sub">Popular picks from our catalog. Sample products for demonstration.</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[18px]">
          {products.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
