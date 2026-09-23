// Seeds the Nexora catalog and demo data. Safe to re-run: catalog rows are upserted by slug/code/email,
// and seed-owned rows (sample variants/tiers/reviews, demo orders) are replaced.
//
// Sources:
//   docs/kijero-products.json                 real catalog (299 entries) → images in media/products/
//   prisma/seed-data/prototype-samples.json   14 sample products + demo data extracted from the prototype
//
// Run: docker compose exec app npx prisma db seed
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Availability,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  ProductCondition,
  QuoteStatus,
} from "../src/generated/prisma/client";

const root = path.resolve(import.meta.dirname, "..");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ---------- helpers ----------

// Same rule as scripts/slugify-media.mjs, so catalog image names line up with media/products/.
const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const money = (n: number) => n.toFixed(2);
const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const mediaExists = (publicPath: string) => fs.existsSync(path.join(root, publicPath.replace(/^\//, "")));
const daysAgo = (days: number) => new Date(Date.now() - days * 864e5);
/** The catalog JSON contains HTML entities in some text ("Splitter &amp; Switcher", 2.25&quot;). */
const namedEntities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
const decodeEntities = (text: string | null) =>
  text == null
    ? null
    : text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
        e[0] === "#"
          ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
          : (namedEntities[e.toLowerCase()] ?? m),
      );

/** Demo contact data must never reach a real inbox (Phase 10 sends real email). */
const demoEmail = (email: string) => `${email.split("@")[0]}@example.com`;

// ---------- categories ----------

const topCategories = [
  { slug: "computers", name: "Computers" },
  { slug: "tablets", name: "Tablets" },
  { slug: "monitors", name: "Monitors" },
  { slug: "networking", name: "Networking" },
  { slug: "power", name: "Power & UPS" },
  { slug: "iot", name: "IoT" },
  { slug: "audio-conferencing", name: "Audio & Conferencing" },
];

// Catalog JSON category → subcategory under a top-level category.
const subCategories = [
  { source: "Network Switches", slug: "network-switches", name: "Network Switches", parent: "networking" },
  { source: "Wireless Access Points", slug: "wireless-access-points", name: "Wireless Access Points", parent: "networking" },
  { source: "Network Audio", slug: "network-audio", name: "Network Audio", parent: "audio-conferencing" },
];

// Prototype category names → top-level slugs.
const prototypeCategory: Record<string, string> = {
  Computers: "computers",
  Tablets: "tablets",
  Monitors: "monitors",
  Networking: "networking",
  Power: "power",
  IoT: "iot",
};

function categoryImage(slug: string) {
  for (const ext of [".webp", ".jpg", ".png"]) {
    const p = `/media/category/${slug}${ext}`;
    if (mediaExists(p)) return p;
  }
  return null;
}

async function seedCategories() {
  const ids = new Map<string, string>();
  for (const [i, c] of topCategories.entries()) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, sortOrder: i, image: categoryImage(c.slug) },
      update: { name: c.name, sortOrder: i, image: categoryImage(c.slug), parentId: null },
    });
    ids.set(c.slug, row.id);
  }
  for (const [i, c] of subCategories.entries()) {
    const parentId = ids.get(c.parent)!;
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, sortOrder: i, parentId },
      update: { name: c.name, sortOrder: i, parentId },
    });
    ids.set(c.slug, row.id);
  }
  return ids;
}

// ---------- real catalog ----------

type CatalogProduct = {
  name: string;
  brand: string;
  sku: string;
  mpn: string | null;
  category: string;
  price: number;
  currency: string;
  availability: string;
  condition: string;
  short_description: string | null;
  description_html: string | null;
  description_text: string | null;
  specifications: Record<string, string>;
  packaging: Record<string, string>;
  image_file: string;
  source_url: string;
};

const brandAliases: Record<string, string> = { "StarTech.com": "StarTech" };

const availabilityMap: Record<string, Availability> = {
  InStock: Availability.IN_STOCK,
  OutOfStock: Availability.OUT_OF_STOCK,
  BackOrder: Availability.BACKORDER,
};

function conditionOf(raw: string): ProductCondition {
  const c = raw.toLowerCase();
  if (c.startsWith("used")) return ProductCondition.USED;
  if (c.startsWith("refurbished")) return ProductCondition.REFURBISHED;
  return ProductCondition.NEW;
}

async function seedCatalog(categoryIds: Map<string, string>, usedSlugs: Set<string>) {
  const { products } = readJson<{ products: CatalogProduct[] }>("docs/kijero-products.json");
  const seenSku = new Set<string>();
  const report = { created: 0, duplicates: [] as string[], missingImages: [] as string[] };

  for (const p of products) {
    if (seenSku.has(p.sku)) {
      report.duplicates.push(`${p.sku} (${p.name}) — also listed under "${p.category}"`);
      continue;
    }
    seenSku.add(p.sku);

    const sub = subCategories.find((c) => c.source === p.category);
    if (!sub) throw new Error(`Unknown catalog category "${p.category}" for ${p.sku}`);

    const name = decodeEntities(p.name)!;
    const slug = slugify(name);
    if (usedSlugs.has(slug)) throw new Error(`Duplicate product slug "${slug}"`);
    usedSlugs.add(slug);

    const imageSlug = slugify(path.basename(p.image_file, path.extname(p.image_file)));
    let image: string | null = `/media/products/${imageSlug}.jpg`;
    if (!mediaExists(image)) {
      report.missingImages.push(`${p.sku}: ${p.image_file}`);
      image = null;
    }

    const specs = Object.entries(p.specifications ?? {}).map(([label, value]) => ({ label, value }));
    const packaging = Object.fromEntries(Object.entries(p.packaging ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const data = {
      slug,
      mpn: p.mpn,
      name,
      brand: brandAliases[p.brand] ?? decodeEntities(p.brand)!,
      categoryId: categoryIds.get(sub.slug)!,
      price: money(p.price),
      currency: p.currency,
      availability: availabilityMap[p.availability] ?? Availability.IN_STOCK,
      condition: conditionOf(p.condition),
      shortDescription: decodeEntities(p.short_description),
      description: decodeEntities(p.description_text),
      descriptionHtml: p.description_html,
      specs: specs.length ? specs : undefined,
      packaging,
      image,
      sourceUrl: p.source_url,
      isSample: false,
    };
    // Matched by SKU (stable), so fixing a name also updates its slug instead of adding a row.
    await db.product.upsert({ where: { sku: p.sku }, create: { sku: p.sku, ...data }, update: data });
    report.created++;
  }
  return report;
}

// ---------- prototype samples ----------

type Samples = {
  products: {
    id: number;
    name: string;
    brand: string;
    category: string;
    price: number;
    oldPrice: number | null;
    rating: number;
    stock: number;
    image: string | null;
    description: string;
    specs: [string, string][];
  }[];
  variants: Record<string, { label: string; opts: { n: string; dp: number }[] }>;
  tiers: Record<string, [number, number, number][]>;
  reviewNames: string[];
  reviewTexts: string[];
  coupons: { code: string; pct: number; on: number }[];
  quotes: { no: string; name: string; company: string; email: string; phone: string; cat: string; qty: string; msg: string; status: string }[];
  demoOrders: { names: string[]; statuses: string[]; payments: string[]; count: number };
};

// Prototype image keys → files in media/ (Phase 4 names).
const sampleImages: Record<string, string> = {
  mon: "/media/category/monitors.webp",
  ups: "/media/category/power.webp",
  wifi: "/media/category/networking.webp",
};

async function seedSamples(samples: Samples, categoryIds: Map<string, string>, usedSlugs: Set<string>) {
  const byPrototypeId = new Map<number, { id: string; name: string; price: number }>();
  const now = Date.now();

  for (const s of samples.products) {
    const slug = slugify(s.name);
    if (usedSlugs.has(slug)) throw new Error(`Sample slug "${slug}" collides with a catalog product`);
    usedSlugs.add(slug);

    const data = {
      name: s.name,
      brand: s.brand,
      categoryId: categoryIds.get(prototypeCategory[s.category])!,
      price: money(s.price),
      compareAtPrice: s.oldPrice == null ? null : money(s.oldPrice),
      stock: s.stock,
      availability: s.stock > 0 ? Availability.IN_STOCK : Availability.OUT_OF_STOCK,
      description: s.description,
      shortDescription: s.description,
      specs: s.specs.map(([label, value]) => ({ label, value })),
      image: s.image ? sampleImages[s.image] : null,
      rating: s.rating.toFixed(1),
      isSample: true,
    };
    const product = await db.product.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    byPrototypeId.set(s.id, { id: product.id, name: s.name, price: s.price });

    // Seed-owned children: replace on every run.
    await db.variant.deleteMany({ where: { productId: product.id } });
    await db.priceTier.deleteMany({ where: { productId: product.id } });
    await db.review.deleteMany({ where: { productId: product.id, customerId: null } });

    const v = samples.variants[s.id];
    if (v) {
      await db.variant.createMany({
        data: v.opts.map((o, i) => ({ productId: product.id, attribute: v.label, name: o.n, priceDelta: money(o.dp), sortOrder: i })),
      });
    }
    const t = samples.tiers[s.id];
    if (t) {
      await db.priceTier.createMany({
        data: t.map(([min, max, mult]) => ({ productId: product.id, minQty: min, maxQty: max >= 999 ? null : max, multiplier: mult.toFixed(3) })),
      });
    }
    // Same deterministic reviews as the prototype's seedReviews().
    const n = 2 + (s.id % 3);
    await db.review.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        productId: product.id,
        authorName: samples.reviewNames[(s.id + i) % samples.reviewNames.length],
        rating: Math.max(3, Math.min(5, Math.round(s.rating) - (i % 2) + ((s.id + i) % 2))),
        body: samples.reviewTexts[(s.id * 3 + i) % samples.reviewTexts.length],
        createdAt: new Date(now - (i + 1) * 5 * 864e5),
      })),
    });
  }
  return byPrototypeId;
}

// ---------- demo data (coupons, customers, orders, quotes) ----------

const orderStatus: Record<string, OrderStatus> = {
  Pending: OrderStatus.PENDING,
  Processing: OrderStatus.PROCESSING,
  Shipped: OrderStatus.SHIPPED,
  Delivered: OrderStatus.DELIVERED,
  Cancelled: OrderStatus.CANCELLED,
};
const paymentMethod: Record<string, PaymentMethod> = {
  "Credit card": PaymentMethod.CREDIT_CARD,
  "Purchase order": PaymentMethod.PURCHASE_ORDER,
  "Bank transfer": PaymentMethod.BANK_TRANSFER,
};
const quoteStatus: Record<string, QuoteStatus> = {
  New: QuoteStatus.NEW,
  Contacted: QuoteStatus.CONTACTED,
  Won: QuoteStatus.WON,
  Closed: QuoteStatus.CLOSED,
};

async function seedDemo(
  samples: Samples,
  categoryIds: Map<string, string>,
  sampleProducts: Map<number, { id: string; name: string; price: number }>,
) {
  for (const c of samples.coupons) {
    await db.coupon.upsert({
      where: { code: c.code },
      create: { code: c.code, percentOff: c.pct, active: !!c.on },
      update: { percentOff: c.pct, active: !!c.on },
    });
  }

  // Customers: the prototype's 10 demo names.
  const { names, statuses, payments, count } = samples.demoOrders;
  const customerIds = new Map<string, string>();
  for (const [i, name] of names.entries()) {
    const email = demoEmail(`${name.split(" ")[0].toLowerCase()}@mail.com`);
    const address = { addressLine: `${100 + i} Main St`, city: "Austin", state: "TX", postalCode: `733${10 + i}`, country: "United States" };
    const row = await db.customer.upsert({
      where: { email },
      create: { email, name, phone: `(555) 010-${2000 + i}`, ...address },
      update: { name },
    });
    customerIds.set(name, row.id);
  }

  // Orders: same recipe as the prototype's a_seed() — 24 orders over the sample products,
  // 8% tax, $25 shipping below $500.
  const P = [...sampleProducts.entries()].sort(([a], [b]) => a - b).map(([, p]) => p);
  const numbers = Array.from({ length: count }, (_, i) => `NX-${100240 - i}`);
  await db.order.deleteMany({ where: { number: { in: numbers }, quote: null } });
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const items = Array.from({ length: 1 + (i % 3) }, (_, j) => {
      const x = P[(i * 3 + j * 5) % P.length];
      const q = 1 + ((i + j) % 2);
      return { productId: x.id, name: x.name, unitPrice: money(x.price), quantity: q, lineTotal: money(x.price * q) };
    });
    const subtotal = items.reduce((sum, it) => sum + Number(it.lineTotal), 0);
    const shippingFee = subtotal < 500 ? 25 : 0;
    const total = Math.round((subtotal * 1.08 + shippingFee) * 100) / 100;
    await db.order.create({
      data: {
        number: numbers[i],
        customerId: customerIds.get(name),
        name,
        email: demoEmail(`${name.split(" ")[0].toLowerCase()}@mail.com`),
        phone: `(555) 010-${2000 + i}`,
        addressLine: `${100 + i} Main St`,
        city: "Austin",
        state: "TX",
        postalCode: `733${10 + i}`,
        country: "United States",
        paymentMethod: paymentMethod[payments[i % payments.length]],
        status: orderStatus[statuses[i % statuses.length]],
        subtotal: money(subtotal),
        shippingFee: money(shippingFee),
        tax: money(total - subtotal - shippingFee),
        total: money(total),
        createdAt: daysAgo(i * 0.6),
        items: { create: items },
      },
    });
  }

  for (const [i, q] of samples.quotes.entries()) {
    const data = {
      name: q.name,
      company: q.company,
      email: demoEmail(q.email),
      phone: q.phone,
      categoryId: categoryIds.get(prototypeCategory[q.cat]) ?? null,
      quantity: q.qty,
      message: q.msg,
      status: quoteStatus[q.status] ?? QuoteStatus.NEW,
    };
    await db.quote.upsert({
      where: { number: q.no },
      create: { number: q.no, createdAt: daysAgo(1 + i * 2), ...data },
      update: data,
    });
  }
}

// ---------- main ----------

async function main() {
  const samples = readJson<Samples>("prisma/seed-data/prototype-samples.json");
  const usedSlugs = new Set<string>();

  const categoryIds = await seedCategories();
  const catalog = await seedCatalog(categoryIds, usedSlugs);
  const sampleProducts = await seedSamples(samples, categoryIds, usedSlugs);
  await seedDemo(samples, categoryIds, sampleProducts);

  const counts = {
    categories: await db.category.count(),
    products: await db.product.count(),
    catalogProducts: await db.product.count({ where: { isSample: false } }),
    sampleProducts: await db.product.count({ where: { isSample: true } }),
    productsWithImage: await db.product.count({ where: { image: { not: null } } }),
    variants: await db.variant.count(),
    priceTiers: await db.priceTier.count(),
    reviews: await db.review.count(),
    customers: await db.customer.count(),
    orders: await db.order.count(),
    orderItems: await db.orderItem.count(),
    quotes: await db.quote.count(),
    coupons: await db.coupon.count(),
  };
  console.table(counts);
  if (catalog.duplicates.length) console.log("Skipped duplicate catalog entries:\n  " + catalog.duplicates.join("\n  "));
  if (catalog.missingImages.length) console.log("Catalog products without an image file:\n  " + catalog.missingImages.join("\n  "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
