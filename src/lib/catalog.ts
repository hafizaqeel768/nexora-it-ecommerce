// Shop listing and product detail queries (server-only).
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toCard, cardInclude, type ProductCardData } from "@/lib/products";

import { PAGE_SIZE, type ShopParams, type SortKey } from "@/lib/catalog-shared";

export { PAGE_SIZE, SORTS, parseShopParams, type ShopParams, type SortKey } from "@/lib/catalog-shared";

/** Every search word must appear in name, brand, SKU or description (the prototype's hit()). */
function searchWhere(q: string): Prisma.ProductWhereInput[] {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      OR: [
        { name: { contains: word, mode: "insensitive" } },
        { brand: { contains: word, mode: "insensitive" } },
        { sku: { contains: word, mode: "insensitive" } },
        { shortDescription: { contains: word, mode: "insensitive" } },
      ],
    }));
}

async function categoryScope(slug: string | null): Promise<string[] | null> {
  if (!slug) return null;
  const cat = await db.category.findUnique({ where: { slug }, include: { children: { select: { id: true } } } });
  if (!cat) return null;
  return [cat.id, ...cat.children.map((c) => c.id)];
}

const orderBy: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  // Products with photos first, then rated ones, then by name.
  featured: [{ image: { sort: "asc", nulls: "last" } }, { rating: { sort: "desc", nulls: "last" } }, { name: "asc" }],
  "price-asc": [{ price: "asc" }, { name: "asc" }],
  "price-desc": [{ price: "desc" }, { name: "asc" }],
  rating: [{ rating: { sort: "desc", nulls: "last" } }, { name: "asc" }],
};

export type ShopResult = {
  products: ProductCardData[];
  total: number;
  pages: number;
  categories: { slug: string; name: string; count: number; children: { slug: string; name: string; count: number }[] }[];
  brands: { name: string; count: number }[];
  allCount: number;
  categoryName: string | null;
};

export async function getShopResults(p: ShopParams): Promise<ShopResult> {
  const scope = await categoryScope(p.category);
  const base: Prisma.ProductWhereInput = { status: "ACTIVE", AND: searchWhere(p.q) };
  const inCategory: Prisma.ProductWhereInput = scope ? { ...base, categoryId: { in: scope } } : base;
  const where: Prisma.ProductWhereInput = {
    ...inCategory,
    ...(p.brands.length ? { brand: { in: p.brands } } : {}),
    ...(p.min != null || p.max != null
      ? { price: { ...(p.min != null ? { gte: p.min } : {}), ...(p.max != null ? { lte: p.max } : {}) } }
      : {}),
    ...(p.rating ? { rating: { gte: p.rating } } : {}),
    ...(p.sale ? { compareAtPrice: { not: null } } : {}),
  };

  const [total, rows, catCounts, brandCounts, allCount, tree] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: cardInclude,
      orderBy: orderBy[p.sort],
      skip: (p.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Category counts follow the search only; brand counts follow search + category.
    db.product.groupBy({ by: ["categoryId"], where: base, _count: { _all: true } }),
    db.product.groupBy({ by: ["brand"], where: inCategory, _count: { _all: true }, orderBy: { brand: "asc" } }),
    db.product.count({ where: base }),
    db.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      include: { children: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  const countOf = (id: string) => catCounts.find((c) => c.categoryId === id)?._count._all ?? 0;
  const categories = tree.map((c) => {
    const children = c.children.map((ch) => ({ slug: ch.slug, name: ch.name, count: countOf(ch.id) }));
    return { slug: c.slug, name: c.name, count: countOf(c.id) + children.reduce((s, ch) => s + ch.count, 0), children };
  });
  const categoryName =
    tree.flatMap((c) => [c, ...c.children]).find((c) => c.slug === p.category)?.name ?? null;

  return {
    products: rows.map(toCard),
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    categories,
    brands: brandCounts.map((b) => ({ name: b.brand, count: b._count._all })),
    allCount,
    categoryName,
  };
}

export type SearchSuggestion = { slug: string; name: string; brand: string; category: string; price: string; image: string | null };

/** Header live search (the prototype's sug()): first 6 matches in shop order, plus the total. */
export async function getSearchSuggestions(q: string): Promise<{ products: SearchSuggestion[]; total: number }> {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE", AND: searchWhere(q) };
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: orderBy.featured,
      take: 6,
      select: { slug: true, name: true, brand: true, price: true, image: true, category: { select: { name: true } } },
    }),
    db.product.count({ where }),
  ]);
  return {
    products: rows.map((r) => ({ slug: r.slug, name: r.name, brand: r.brand, category: r.category.name, price: r.price.toString(), image: r.image })),
    total,
  };
}

/** A category's name and search-engine texts (shop page metadata). */
export async function getCategoryMeta(slug: string | null) {
  if (!slug) return null;
  return db.category.findUnique({ where: { slug }, select: { name: true, description: true, image: true, seoTitle: true, seoDescription: true } });
}

// ---------- product detail ----------

// cache(): generateMetadata and the page share one query per request.
export const getProduct = cache(async (slug: string) => {
  const p = await db.product.findUnique({
    where: { slug },
    include: {
      category: { include: { parent: true } },
      variants: { orderBy: { sortOrder: "asc" } },
      priceTiers: { orderBy: { minQty: "asc" } },
      reviews: { where: { approved: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p || p.status !== "ACTIVE") return null;

  const specs = Array.isArray(p.specs) ? (p.specs as { label: string; value: string }[]) : [];
  const pack = (p.packaging ?? {}) as Record<string, string>;
  const dims = [pack.length, pack.width, pack.height].filter(Boolean).join(" × ");
  const details = [
    ...specs,
    ...(p.sku ? [{ label: "SKU", value: p.sku }] : []),
    ...(p.mpn && p.mpn !== p.sku ? [{ label: "MPN", value: p.mpn }] : []),
    ...(p.condition !== "NEW" ? [{ label: "Condition", value: p.condition === "USED" ? "Used" : "Refurbished" }] : []),
    ...(dims ? [{ label: "Package dimensions", value: dims }] : []),
    ...(pack.weight ? [{ label: "Package weight", value: pack.weight }] : []),
  ];

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: { slug: p.category.slug, name: p.category.name },
    parent: p.category.parent ? { slug: p.category.parent.slug, name: p.category.parent.name } : null,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice),
    stock: p.stock,
    availability: p.availability,
    rating: p.rating == null ? null : Number(p.rating),
    description: p.description ?? p.shortDescription,
    images: [p.image, ...p.gallery].filter((u): u is string => !!u),
    topCategoryIcon: (p.category.parent ?? p.category).icon,
    details,
    variants: p.variants.map((v) => ({ id: v.id, attribute: v.attribute, name: v.name, priceDelta: Number(v.priceDelta) })),
    tiers: p.priceTiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, multiplier: Number(t.multiplier) })),
    reviews: p.reviews.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, title: r.title, body: r.body, verified: r.verifiedBuyer, date: r.createdAt.toISOString() })),
    categoryId: p.categoryId,
    sku: p.sku,
    mpn: p.mpn,
    condition: p.condition,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  };
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** Same category first, then the rest (the prototype's related row), up to 10. */
export async function getRelated(product: ProductDetail): Promise<ProductCardData[]> {
  const same = await db.product.findMany({
    where: { status: "ACTIVE", categoryId: product.categoryId, id: { not: product.id } },
    include: cardInclude,
    orderBy: orderBy.featured,
    take: 10,
  });
  const rest =
    same.length < 10
      ? await db.product.findMany({
          where: { status: "ACTIVE", categoryId: { not: product.categoryId }, id: { not: product.id } },
          include: cardInclude,
          orderBy: orderBy.featured,
          take: 10 - same.length,
        })
      : [];
  return [...same, ...rest].map(toCard);
}
