// Product queries shared by pages (server-only). Returns plain, serializable data for components.
import type { CartProduct } from "@/lib/cart-types";
import { db } from "@/lib/db";

export type ProductCardData = {
  slug: string;
  name: string;
  brand: string;
  categoryName: string;
  /** Top-level category's icon (Admin → Categories); shown when there is no photo */
  topCategoryIcon: string | null;
  price: string;
  compareAtPrice: string | null;
  rating: number | null;
  image: string | null;
  hoverImage: string | null;
  badge: "sale" | "bulk" | "options" | null;
  /** For "Add to cart" on the card (default variant, like the prototype) */
  cart: CartProduct;
};

export const cardInclude = {
  category: { include: { parent: true } },
  priceTiers: { orderBy: { minQty: "asc" } },
  variants: { orderBy: { sortOrder: "asc" }, take: 1 },
  _count: { select: { priceTiers: true, variants: true } },
} as const;

type CardRow = Awaited<ReturnType<typeof findCardRows>>[number];

function findCardRows(where: { slug: { in: string[] } }) {
  return db.product.findMany({ where: { ...where, status: "ACTIVE" }, include: cardInclude });
}

export function toCard(p: CardRow): ProductCardData {
  const top = p.category.parent ?? p.category;
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    categoryName: p.category.name,
    topCategoryIcon: top.icon,
    price: p.price.toString(),
    compareAtPrice: p.compareAtPrice?.toString() ?? null,
    rating: p.rating == null ? null : Number(p.rating),
    image: p.image,
    hoverImage: p.gallery[0] ?? null,
    // Same priority as the prototype's card(): Sale, then Bulk pricing, then Options.
    badge: p.compareAtPrice ? "sale" : p._count.priceTiers ? "bulk" : p._count.variants ? "options" : null,
    cart: {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      image: p.image,
      price: Number(p.price),
      tiers: p.priceTiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, multiplier: Number(t.multiplier) })),
      variantId: p.variants[0]?.id ?? null,
      variantName: p.variants[0] ? `${p.variants[0].attribute}: ${p.variants[0].name}` : null,
      variantDelta: p.variants[0] ? Number(p.variants[0].priceDelta) : 0,
      maxQty: p.stock ?? 999,
      available: p.availability !== "OUT_OF_STOCK" && p.stock !== 0,
    },
  };
}

// The prototype's featured picks (products 6, 13, 14, 3), kept in that order.
const FEATURED_SLUGS = [
  "dell-ultrasharp-u2724d-27-qhd",
  "cyberpower-lcd-line-interactive-ups-1500va",
  "ubiquiti-airmax-powerbeam-5ac-wireless-bridge",
  "lenovo-thinkpad-t14-gen-4",
];

export async function getFeaturedProducts(): Promise<ProductCardData[]> {
  const rows = await findCardRows({ slug: { in: FEATURED_SLUGS } });
  return FEATURED_SLUGS.flatMap((slug) => {
    const row = rows.find((r) => r.slug === slug);
    return row ? [toCard(row)] : [];
  });
}

/** Brands with the most active products, for the home page marquee. */
export async function getTopBrands(limit = 10): Promise<string[]> {
  const rows = await db.product.groupBy({
    by: ["brand"],
    where: { status: "ACTIVE" },
    _count: { brand: true },
    orderBy: [{ _count: { brand: "desc" } }, { brand: "asc" }],
    take: limit,
  });
  return rows.map((r) => r.brand);
}

/** Name and top-level category of a product, to pre-fill the quote form from "Request quote". */
export async function getQuoteProduct(slug: string | undefined) {
  if (!slug) return null;
  const p = await db.product.findUnique({
    where: { slug },
    select: { name: true, category: { select: { slug: true, parent: { select: { slug: true } } } } },
  });
  return p ? { name: p.name, category: p.category.parent?.slug ?? p.category.slug } : null;
}

/** Top-level categories (for the quote form's category select). */
export function getTopCategories() {
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true },
  });
}
