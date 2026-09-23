// Product CSV import (server-only, Phase 12). Same columns as Admin → Products → Export CSV, so an export can
// be edited in a spreadsheet and imported back. Rows are matched by "URL slug", then SKU; others are created.
// Only columns present in the file are changed; on updates an empty required cell keeps the current value.
import { Availability, type Prisma } from "@/generated/prisma/client";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";

export const MAX_IMPORT_ROWS = 2000;

const COLUMNS = {
  sku: ["sku"],
  name: ["name", "product", "product name"],
  brand: ["brand"],
  category: ["category"],
  price: ["price"],
  compareAt: ["compare-at price", "compare at price", "compareatprice", "old price"],
  stock: ["stock", "qty", "quantity"],
  status: ["status"],
  slug: ["url slug", "slug"],
  description: ["description"],
} as const;
type Col = keyof typeof COLUMNS;

export type PlannedRow = {
  line: number;
  action: "create" | "update" | "unchanged" | "error";
  key: string;
  name: string;
  errors: string[];
  changes: string[];
  productId?: string;
  data?: Prisma.ProductUncheckedCreateInput;
};

export type ImportPlan = { columns: Col[]; unknown: string[]; rows: PlannedRow[]; counts: Record<PlannedRow["action"], number> };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";

const num = (s: string) => Number(s.replace(/[$,\s]/g, ""));

export async function planImport(csv: string): Promise<ImportPlan | { error: string }> {
  const table = parseCsv(csv);
  if (table.length < 2) return { error: "The file has no product rows (the first row must be the column names)." };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { error: `At most ${MAX_IMPORT_ROWS} products per file; split it into smaller files.` };

  const header = table[0].map((h) => h.toLowerCase().trim());
  const index: Partial<Record<Col, number>> = {};
  const unknown: string[] = [];
  header.forEach((h, i) => {
    const col = (Object.keys(COLUMNS) as Col[]).find((c) => (COLUMNS[c] as readonly string[]).includes(h));
    if (col && index[col] === undefined) index[col] = i;
    else if (h) unknown.push(table[0][i]);
  });
  if (index.name === undefined && index.slug === undefined && index.sku === undefined) {
    return { error: "No Name, SKU or URL slug column found. Use the columns of Products → Export CSV." };
  }

  const [categories, existing] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, slug: true } }),
    db.product.findMany({
      select: { id: true, slug: true, sku: true, name: true, brand: true, categoryId: true, price: true, compareAtPrice: true, stock: true, status: true, description: true },
    }),
  ]);
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
  const findCategory = (v: string) => categories.find((c) => c.slug === v.toLowerCase() || c.name.toLowerCase() === v.toLowerCase());
  const usedKeys = new Set<string>();
  const newSlugs = new Set<string>();

  const rows: PlannedRow[] = table.slice(1).map((cells, i) => {
    const line = i + 2;
    const get = (c: Col) => (index[c] === undefined ? undefined : (cells[index[c]!] ?? "").trim());
    const errors: string[] = [];
    const slugCell = get("slug");
    const skuCell = get("sku");
    const match = (slugCell && bySlug.get(slugCell)) || (skuCell && bySku.get(skuCell.toLowerCase())) || null;
    // || (not ??): an empty cell is "", which must fall through to the next identifier.
    const key = match?.slug || slugCell || (skuCell && `sku:${skuCell.toLowerCase()}`) || get("name") || `line ${line}`;
    if (usedKeys.has(key)) errors.push("The same product appears more than once in the file.");
    usedKeys.add(key);

    const cur = match;
    const pick = (c: Col) => {
      const v = get(c);
      return v === undefined || v === "" ? undefined : v;
    };
    const name = pick("name") ?? cur?.name ?? "";
    const brand = pick("brand") ?? cur?.brand ?? "";
    const catCell = pick("category");
    const category = catCell ? findCategory(catCell) : null;
    if (catCell && !category) errors.push(`Unknown category “${catCell}” (create it in Categories first).`);
    const categoryId = category?.id ?? cur?.categoryId ?? "";
    const priceCell = pick("price");
    const price = priceCell !== undefined ? num(priceCell) : cur ? Number(cur.price) : NaN;
    if (!name) errors.push("Name is required.");
    if (!brand) errors.push("Brand is required.");
    if (!categoryId && !catCell) errors.push("Category is required.");
    if (!Number.isFinite(price) || price < 0) errors.push(`Price “${priceCell ?? ""}” is not an amount.`);

    let compareAt: number | null | undefined = undefined;
    const ca = get("compareAt");
    if (ca !== undefined) compareAt = ca === "" ? null : num(ca);
    if (compareAt != null && (!Number.isFinite(compareAt) || compareAt <= price)) errors.push("Compare-at price must be empty or higher than the price.");

    let stock: number | null | undefined = undefined;
    const st = get("stock");
    if (st !== undefined) stock = st === "" || /not tracked/i.test(st) ? null : num(st);
    if (stock != null && (!Number.isInteger(stock) || stock < 0)) errors.push(`Stock “${st}” must be a whole number or “not tracked”.`);

    const statusCell = pick("status")?.toLowerCase();
    if (statusCell && !["active", "draft", "live"].includes(statusCell)) errors.push(`Status “${statusCell}” must be active or draft.`);
    const status = statusCell ? (statusCell === "draft" ? "DRAFT" : "ACTIVE") : (cur?.status ?? "ACTIVE");

    const sku = skuCell === undefined ? cur?.sku ?? null : skuCell || null;
    if (sku) {
      const owner = bySku.get(sku.toLowerCase());
      if (owner && owner.id !== cur?.id) errors.push(`SKU ${sku} already belongs to “${owner.name}”.`);
    }
    const description = get("description");

    if (errors.length) return { line, action: "error" as const, key, name, errors, changes: [] };

    const data: Prisma.ProductUncheckedCreateInput = {
      slug: cur?.slug ?? "",
      name,
      brand,
      categoryId,
      price: Math.round(price * 100) / 100,
      sku,
      status,
      ...(compareAt !== undefined && { compareAtPrice: compareAt == null ? null : Math.round(compareAt * 100) / 100 }),
      ...(stock !== undefined && { stock, availability: stock === 0 ? Availability.OUT_OF_STOCK : Availability.IN_STOCK }),
      ...(description !== undefined && { description: description || null }),
    };

    if (!cur) {
      let slug = slugCell && /^[a-z0-9-]+$/.test(slugCell) ? slugCell : slugify(name);
      for (let n = 2; bySlug.has(slug) || newSlugs.has(slug); n++) slug = `${slugify(name)}-${n}`;
      newSlugs.add(slug);
      return { line, action: "create" as const, key, name, errors, changes: [], data: { ...data, slug } };
    }

    const changes: string[] = [];
    if (name !== cur.name) changes.push("name");
    if (brand !== cur.brand) changes.push("brand");
    if (categoryId !== cur.categoryId) changes.push("category");
    if (Math.round(price * 100) !== Math.round(Number(cur.price) * 100)) changes.push(`price ${Number(cur.price)} → ${price}`);
    if (compareAt !== undefined && (compareAt ?? null) !== (cur.compareAtPrice == null ? null : Number(cur.compareAtPrice))) changes.push("compare-at price");
    if (stock !== undefined && stock !== cur.stock) changes.push(`stock ${cur.stock ?? "—"} → ${stock ?? "—"}`);
    if (status !== cur.status) changes.push(status === "ACTIVE" ? "published" : "set to draft");
    if ((sku ?? null) !== (cur.sku ?? null)) changes.push("SKU");
    if (description !== undefined && (description || null) !== cur.description) changes.push("description");
    return { line, action: changes.length ? ("update" as const) : ("unchanged" as const), key, name, errors, changes, productId: cur.id, data };
  });

  const counts = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const r of rows) counts[r.action]++;
  return { columns: Object.keys(index) as Col[], unknown, rows, counts };
}

/** Writes the planned creates/updates (rows with errors are never written). */
export async function applyImport(plan: ImportPlan) {
  const todo = plan.rows.filter((r) => (r.action === "create" || r.action === "update") && r.data);
  for (let i = 0; i < todo.length; i += 100) {
    await db.$transaction(
      todo.slice(i, i + 100).map((r) => {
        const { slug, ...rest } = r.data!;
        return r.action === "create" ? db.product.create({ data: { ...rest, slug } }) : db.product.update({ where: { id: r.productId }, data: rest });
      }),
    );
  }
  return todo.length;
}
