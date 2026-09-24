import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { categoryHref } from "@/lib/site-nav";
import { absoluteUrl } from "@/lib/site-url";

// /sitemap.xml: home, shop, every category with active products and every active product.
// Built from the database on request, so new products appear without a rebuild.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { slug: "asc" }, select: { slug: true, updatedAt: true, image: true, categoryId: true } }),
    db.category.findMany({ select: { id: true, slug: true, parentId: true, updatedAt: true } }),
  ]);
  const withProducts = new Set(products.map((p) => p.categoryId));
  // A top-level category is listed when it or one of its subcategories has products.
  for (const c of categories) if (c.parentId && withProducts.has(c.id)) withProducts.add(c.parentId);
  const latest = products.reduce((d, p) => (p.updatedAt > d ? p.updatedAt : d), new Date(0));

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), lastModified: latest, changeFrequency: "daily", priority: 0.8 },
    ...categories
      .filter((c) => withProducts.has(c.id))
      .map((c) => ({ url: absoluteUrl(categoryHref(c.slug)), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({
      url: absoluteUrl(`/product/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      ...(p.image ? { images: [absoluteUrl(p.image)] } : {}),
    })),
  ];
}
