// Products for Data Transfer (Phase 15). Replaces the Phase 12 product import (same columns, so old exports
// still import). Rows match existing products by SKU, then URL slug. Only columns in the file are changed.
import { Availability, type Prisma } from "@/generated/prisma/client";
import { getConfig } from "@/lib/config";
import type { ExportAdapter, ImportAdapter, PlannedRow } from "@/lib/data-transfer/types";
import { parseInteger, parseMoney, parseText, SLUG, slugify } from "@/lib/data-transfer/values";
import { db } from "@/lib/db";

type Cat = { id: string; name: string; slug: string };
type Existing = {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  brand: string;
  categoryId: string;
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  stock: number | null;
  status: "ACTIVE" | "DRAFT";
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};
type Ctx = { categories: Cat[]; bySku: Map<string, Existing>; bySlug: Map<string, Existing>; seen: Map<string, number>; newSlugs: Set<string>; newSkus: Map<string, number> };
type Write = { id?: string; data: Prisma.ProductUncheckedCreateInput };

export function findCategory(categories: Cat[], value: string): Cat | "ambiguous" | null {
  const v = value.trim().toLowerCase();
  const bySlug = categories.find((c) => c.slug === v);
  if (bySlug) return bySlug;
  const byName = categories.filter((c) => c.name.toLowerCase() === v);
  return byName.length > 1 ? "ambiguous" : (byName[0] ?? null);
}

const money = (d: Prisma.Decimal | null) => (d == null ? null : Number(d));

export const productImport: ImportAdapter<Ctx, Write> = {
  entity: "products",
  label: "Products",
  permission: "products.import",
  behaviors: ["add", "update", "add_update"],
  columns: [
    { key: "sku", header: "SKU", required: "key", type: "text", description: "Unique product code. Used to find existing products.", example: "NX-SW-24P" },
    { key: "url_slug", header: "URL slug", aliases: ["slug", "url key"], required: "key", type: "text", description: "Lowercase letters, numbers and dashes. Also finds existing products; new products get one from the name when empty.", example: "24-port-poe-switch" },
    { key: "name", header: "Name", aliases: ["product", "product name"], required: "create", type: "text", description: "Product name (max 200 characters).", example: "24-Port Gigabit PoE+ Switch" },
    { key: "brand", header: "Brand", required: "create", type: "text", description: "Brand name (max 80 characters).", example: "Netgear" },
    { key: "category", header: "Category", required: "create", type: "reference", description: "Name or URL name of an existing category (create categories first).", example: "Switches" },
    { key: "price", header: "Price", required: "create", type: "money", description: "Selling price, up to 2 decimals, no currency sign needed.", example: "349.00" },
    { key: "compare_at_price", header: "Compare-at price", aliases: ["compare at price", "old price"], required: false, type: "money", description: "Previous price shown struck through; must be higher than Price. Empty clears it.", example: "399.00" },
    { key: "stock", header: "Stock", aliases: ["qty", "quantity"], required: false, type: "integer", description: "Units in stock (whole number ≥ 0). Empty or “not tracked” turns stock tracking off.", example: "25" },
    { key: "status", header: "Status", required: false, type: "choice", values: ["active", "draft"], description: "active = visible in the store, draft = hidden. New products default to active.", example: "active" },
    { key: "description", header: "Description", required: false, type: "text", description: "Plain text description.", example: "Managed switch with 24 PoE+ ports." },
    { key: "seo_title", header: "SEO title", required: false, type: "text", description: "Page title for search engines (max 200). Empty = product name.", example: "" },
    { key: "seo_description", header: "SEO description", required: false, type: "text", description: "Meta description (max 400). Empty = from the description.", example: "" },
  ],
  notes: [
    "Rows are matched to existing products by SKU, then URL slug. If SKU and URL slug point to two different products, the row is refused.",
    "Only the columns in the file are changed. On updates, an empty Name/Brand/Category/Price cell keeps the current value.",
    "Photos, options and bulk prices are not imported; edit them on the product page.",
  ],
  sample: [
    { sku: "NX-SW-24P", url_slug: "", name: "24-Port Gigabit PoE+ Switch", brand: "Netgear", category: "Switches", price: "349.00", compare_at_price: "399.00", stock: "25", status: "active", description: "Managed switch with 24 PoE+ ports." },
    { sku: "NX-AP-WIFI7", url_slug: "", name: "Wi-Fi 7 Access Point", brand: "Ubiquiti", category: "Wireless", price: "189.99", compare_at_price: "", stock: "not tracked", status: "draft", description: "" },
  ],

  async load() {
    const [categories, products] = await Promise.all([
      db.category.findMany({ select: { id: true, name: true, slug: true } }),
      db.product.findMany({
        select: { id: true, slug: true, sku: true, name: true, brand: true, categoryId: true, price: true, compareAtPrice: true, stock: true, status: true, description: true, seoTitle: true, seoDescription: true },
      }),
    ]);
    return {
      categories,
      bySku: new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p])),
      bySlug: new Map(products.map((p) => [p.slug, p])),
      seen: new Map(),
      newSlugs: new Set(),
      newSkus: new Map(),
    };
  },

  plan(row, ctx, behavior) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const out = (action: PlannedRow<Write>["action"], key: string, extra: Partial<PlannedRow<Write>> = {}): PlannedRow<Write> => ({ line: row.line, key, action, errors, warnings, changes: [], ...extra });
    const cell = (k: string) => {
      const v = row.get(k);
      return v === undefined || v === "" ? undefined : v;
    };

    const sku = cell("sku");
    const slug = cell("url_slug")?.toLowerCase();
    if (sku && sku.length > 64) errors.push("SKU is longer than 64 characters.");
    if (slug && !SLUG.test(slug)) errors.push(`URL slug “${slug}” may only contain lowercase letters, numbers and dashes.`);
    const bySku = sku ? ctx.bySku.get(sku.toLowerCase()) : undefined;
    const bySlug = slug ? ctx.bySlug.get(slug) : undefined;
    if (bySku && bySlug && bySku.id !== bySlug.id) errors.push(`SKU ${sku} belongs to “${bySku.name}” but URL slug ${slug} belongs to “${bySlug.name}”.`);
    const cur = bySku ?? bySlug;
    const key = sku ? `SKU ${sku}` : slug ? `/${slug}` : (cell("name") ?? `row ${row.line}`);

    const identity = cur?.id ?? (sku ? `sku:${sku.toLowerCase()}` : slug ? `slug:${slug}` : null);
    if (identity) {
      const earlier = ctx.seen.get(identity);
      if (earlier) errors.push(`Duplicate: the same product is already in row ${earlier}.`);
      else ctx.seen.set(identity, row.line);
    }
    if (errors.length) return out("skip", key);

    if (cur && behavior === "add") return out("skip", key, { warnings: ["Already exists; skipped (behavior: Add)."] });
    if (!cur && behavior === "update") {
      if (!sku && !slug) return out("skip", key, { errors: ["SKU or URL slug is required to find the product to update."] });
      return out("skip", key, { warnings: ["No product with this SKU / URL slug; skipped (behavior: Update)."] });
    }

    const text = (k: string, label: string, max: number) => {
      const v = row.get(k);
      if (v === undefined) return undefined;
      const r = parseText(v, label, max);
      if (r.error !== undefined) errors.push(r.error);
      return r.value;
    };
    const name = text("name", "Name", 200) || cur?.name || "";
    const brand = text("brand", "Brand", 80) || cur?.brand || "";
    if (!name) errors.push("Name is required.");
    if (!brand) errors.push("Brand is required.");

    let categoryId = cur?.categoryId ?? "";
    const catCell = cell("category");
    if (catCell) {
      const found = findCategory(ctx.categories, catCell);
      if (found === "ambiguous") errors.push(`More than one category is called “${catCell}”; use its URL name.`);
      else if (found) categoryId = found.id;
      else if (cur) warnings.push(`Category “${catCell}” not found; the current category is kept.`);
      else errors.push(`Category “${catCell}” not found (create it in Categories first).`);
    } else if (!cur) errors.push("Category is required.");

    let price = cur ? Number(cur.price) : NaN;
    const priceCell = cell("price");
    if (priceCell !== undefined) {
      const r = parseMoney(priceCell, "Price");
      if (r.error !== undefined) errors.push(r.error);
      else price = r.value;
    } else if (!cur) errors.push("Price is required.");

    let compareAt: number | null | undefined;
    const ca = row.get("compare_at_price");
    if (ca !== undefined) {
      if (ca === "") compareAt = null;
      else {
        const r = parseMoney(ca, "Compare-at price");
        if (r.error !== undefined) errors.push(r.error);
        else if (Number.isFinite(price) && r.value <= price) errors.push("Compare-at price must be higher than the price (or empty).");
        else compareAt = r.value;
      }
    }

    let stock: number | null | undefined;
    const st = row.get("stock");
    if (st !== undefined) {
      if (st === "" || /^not tracked$/i.test(st)) stock = null;
      else {
        const r = parseInteger(st, "Stock", 0, 10_000_000);
        if (r.error !== undefined) errors.push(r.error);
        else stock = r.value;
      }
    }

    let status = cur?.status ?? ("ACTIVE" as const);
    const statusCell = cell("status")?.toLowerCase();
    if (statusCell) {
      if (statusCell === "active" || statusCell === "live") status = "ACTIVE";
      else if (statusCell === "draft") status = "DRAFT";
      else errors.push(`Status “${statusCell}” must be active or draft.`);
    }

    // SKU: new products and SKU changes must not collide with another product or another row.
    const newSku = row.get("sku") === undefined ? (cur?.sku ?? null) : (sku ?? null);
    if (newSku && newSku.toLowerCase() !== cur?.sku?.toLowerCase()) {
      const owner = ctx.bySku.get(newSku.toLowerCase());
      if (owner && owner.id !== cur?.id) errors.push(`SKU ${newSku} already belongs to “${owner.name}”.`);
      const inFile = ctx.newSkus.get(newSku.toLowerCase());
      if (inFile) errors.push(`SKU ${newSku} is also used in row ${inFile}.`);
      else ctx.newSkus.set(newSku.toLowerCase(), row.line);
    }
    if (slug && cur && slug !== cur.slug) {
      // matched by SKU but a different slug: changing a URL is allowed if it is free
      if (ctx.bySlug.has(slug) || ctx.newSlugs.has(slug)) errors.push(`URL slug ${slug} is already used.`);
      else ctx.newSlugs.add(slug);
    }

    const description = text("description", "Description", 20_000);
    const seoTitle = text("seo_title", "SEO title", 200);
    const seoDescription = text("seo_description", "SEO description", 400);
    if (errors.length) return out(cur ? "update" : "create", key);

    const data: Prisma.ProductUncheckedCreateInput = {
      slug: slug ?? cur?.slug ?? "",
      name,
      brand,
      categoryId,
      price,
      sku: newSku,
      status,
      ...(compareAt !== undefined && { compareAtPrice: compareAt }),
      ...(stock !== undefined && { stock, availability: stock === 0 ? Availability.OUT_OF_STOCK : Availability.IN_STOCK }),
      ...(description !== undefined && { description: description || null }),
      ...(seoTitle !== undefined && { seoTitle: seoTitle || null }),
      ...(seoDescription !== undefined && { seoDescription: seoDescription || null }),
    };

    if (!cur) {
      let s = slug ?? slugify(name, "product");
      if (slug && (ctx.bySlug.has(slug) || ctx.newSlugs.has(slug))) return out("create", key, { errors: [`URL slug ${slug} is already used.`] });
      for (let n = 2; ctx.bySlug.has(s) || ctx.newSlugs.has(s); n++) s = `${slugify(name, "product")}-${n}`;
      ctx.newSlugs.add(s);
      return out("create", key, { changes: [`/${s}`], write: { data: { ...data, slug: s } } });
    }

    const changes: string[] = [];
    if (name !== cur.name) changes.push("name");
    if (brand !== cur.brand) changes.push("brand");
    if (categoryId !== cur.categoryId) changes.push("category");
    if (Math.round(price * 100) !== Math.round(Number(cur.price) * 100)) changes.push(`price ${Number(cur.price)} → ${price}`);
    if (compareAt !== undefined && compareAt !== money(cur.compareAtPrice)) changes.push("compare-at price");
    if (stock !== undefined && stock !== cur.stock) changes.push(`stock ${cur.stock ?? "not tracked"} → ${stock ?? "not tracked"}`);
    if (status !== cur.status) changes.push(status === "ACTIVE" ? "published" : "set to draft");
    if ((newSku ?? null) !== (cur.sku ?? null)) changes.push("SKU");
    if (data.slug !== cur.slug) changes.push("URL slug");
    if (description !== undefined && (description || null) !== cur.description) changes.push("description");
    if (seoTitle !== undefined && (seoTitle || null) !== cur.seoTitle) changes.push("SEO title");
    if (seoDescription !== undefined && (seoDescription || null) !== cur.seoDescription) changes.push("SEO description");
    if (!changes.length) return out("skip", key, { warnings: [], changes: [] });
    return out("update", key, { changes, write: { id: cur.id, data } });
  },

  async write(tx, w, action) {
    if (action === "create") await tx.product.create({ data: w.data });
    else await tx.product.update({ where: { id: w.id }, data: w.data });
  },
};

// ---------- export ----------

type Filters = { search: string; sku: string; categoryIds: string[] | null; status: "ACTIVE" | "DRAFT" | null; priceMin: number | null; priceMax: number | null; stock: string; lowStockAt: number };

function where(f: Filters): Prisma.ProductWhereInput {
  const words = f.search.split(/\s+/).filter(Boolean);
  const stock: Prisma.ProductWhereInput | null =
    f.stock === "in"
      ? { OR: [{ stock: { gt: 0 } }, { stock: null, availability: { not: "OUT_OF_STOCK" } }] }
      : f.stock === "out"
        ? { OR: [{ stock: 0 }, { stock: null, availability: "OUT_OF_STOCK" }] }
        : f.stock === "low"
          ? { stock: { not: null, lte: f.lowStockAt } }
          : f.stock === "untracked"
            ? { stock: null }
            : null;
  return {
    AND: [
      ...words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { brand: { contains: w, mode: "insensitive" as const } }, { sku: { contains: w, mode: "insensitive" as const } }] })),
      ...(f.sku ? [{ sku: { contains: f.sku, mode: "insensitive" as const } }] : []),
      ...(f.categoryIds ? [{ categoryId: { in: f.categoryIds } }] : []),
      ...(f.status ? [{ status: f.status }] : []),
      ...(f.priceMin != null ? [{ price: { gte: f.priceMin } }] : []),
      ...(f.priceMax != null ? [{ price: { lte: f.priceMax } }] : []),
      ...(stock ? [stock] : []),
    ],
  };
}

export const productExport: ExportAdapter<Filters> = {
  entity: "products",
  label: "Products",
  permission: "products.export",
  filters: [
    { key: "q", label: "Search (name, brand, SKU)", type: "text" },
    { key: "sku", label: "SKU contains", type: "text" },
    { key: "cat", label: "Category (URL name)", type: "text", placeholder: "e.g. networking" },
    { key: "status", label: "Status", type: "choice", options: [{ value: "", label: "Any" }, { value: "ACTIVE", label: "Active" }, { value: "DRAFT", label: "Draft" }] },
    { key: "price_min", label: "Price from", type: "number", min: 0, step: "0.01" },
    { key: "price_max", label: "Price to", type: "number", min: 0, step: "0.01" },
    {
      key: "stock",
      label: "Stock",
      type: "choice",
      options: [
        { value: "", label: "Any" },
        { value: "in", label: "In stock" },
        { value: "out", label: "Out of stock" },
        { value: "low", label: "Low stock" },
        { value: "untracked", label: "Not tracked" },
      ],
    },
  ],
  async parseFilters(p) {
    const errors: string[] = [];
    const num = (k: string, label: string) => {
      const v = (p.get(k) ?? "").trim();
      if (!v) return null;
      const r = parseMoney(v, label);
      if (r.error !== undefined) errors.push(r.error);
      return r.value ?? null;
    };
    const catSlug = (p.get("cat") ?? "").trim().toLowerCase();
    let categoryIds: string[] | null = null;
    if (catSlug) {
      const c = await db.category.findUnique({ where: { slug: catSlug }, select: { id: true, children: { select: { id: true } } } });
      if (!c) errors.push(`Category “${catSlug}” not found.`);
      categoryIds = c ? [c.id, ...c.children.map((x) => x.id)] : [];
    }
    const status = p.get("status");
    const stock = p.get("stock") ?? "";
    if (stock && !["in", "out", "low", "untracked"].includes(stock)) errors.push("Unknown stock filter.");
    const filters: Filters = {
      search: (p.get("q") ?? "").slice(0, 100),
      sku: (p.get("sku") ?? "").trim().slice(0, 64),
      categoryIds,
      status: status === "ACTIVE" || status === "DRAFT" ? status : null,
      priceMin: num("price_min", "Price from"),
      priceMax: num("price_max", "Price to"),
      stock,
      lowStockAt: (await getConfig("inventory")).lowStockAt,
    };
    if (filters.priceMin != null && filters.priceMax != null && filters.priceMin > filters.priceMax) errors.push("“Price from” is higher than “Price to”.");
    return { filters, errors };
  },
  count: (f) => db.product.count({ where: where(f) }),
  headers: productImport.columns.filter((c) => !c.exportOnly).map((c) => c.header),
  async page(f, cursor, take) {
    const rows = await db.product.findMany({
      where: where(f),
      orderBy: { id: "asc" },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { category: { select: { name: true } } },
    });
    return {
      last: rows.at(-1)?.id ?? null,
      rows: rows.map((p) => [
        p.sku,
        p.slug,
        p.name,
        p.brand,
        p.category.name,
        p.price.toString(),
        p.compareAtPrice?.toString(),
        p.stock ?? "not tracked",
        p.status === "ACTIVE" ? "active" : "draft",
        p.description,
        p.seoTitle,
        p.seoDescription,
      ]),
    };
  },
};
