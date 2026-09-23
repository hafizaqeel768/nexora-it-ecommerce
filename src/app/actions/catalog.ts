"use server";

// Catalog management actions (Phase 12): categories, brands, product options and bulk tiers, reviews, CSV import.
// Every action checks the admin role itself.
import { revalidatePath } from "next/cache";
import type { AdminFormState } from "@/app/actions/admin";
import { assertAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { isCategoryIcon } from "@/lib/site-nav";
import { deleteUploads, saveUploads } from "@/lib/uploads";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const flag = (form: FormData, key: string) => form.get(key) === "on";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function fail(fields: Record<string, string>): AdminFormState {
  return { error: `Please check: ${Object.values(fields).join(" ")}`, fields };
}

function refreshCatalog() {
  revalidatePath("/", "layout"); // menu, footer, home tiles, shop filters
  revalidatePath("/admin/categories");
}

// ---------- categories ----------

export async function saveCategory(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const id = text(form, "id", 40) || null;
  const existing = id ? await db.category.findUnique({ where: { id }, include: { _count: { select: { children: true } } } }) : null;
  if (id && !existing) return { error: "This category no longer exists." };

  const name = text(form, "name", 80);
  const slug = text(form, "slug", 60).toLowerCase() || slugify(name);
  const parentId = text(form, "parentId", 40) || null;
  const icon = text(form, "icon", 40) || null;
  const sortOrder = Number(text(form, "sortOrder", 6) || "0");

  const fields: Record<string, string> = {};
  if (!name) fields.name = "Name is required.";
  if (!SLUG.test(slug)) fields.slug = "URL name: lowercase letters, numbers and dashes (e.g. network-switches).";
  else if (await db.category.findFirst({ where: { slug, NOT: id ? { id } : undefined }, select: { id: true } })) fields.slug = "Another category already uses this URL name.";
  if (parentId) {
    const parent = await db.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent || parent.parentId) fields.parentId = "The parent must be a top-level category (two levels only).";
    else if (parentId === id) fields.parentId = "A category can't be its own parent.";
    else if (existing && existing._count.children > 0) fields.parentId = "This category has subcategories, so it must stay top-level.";
  }
  if (icon && !isCategoryIcon(icon)) fields.icon = "Choose an icon from the list.";
  if (!Number.isInteger(sortOrder)) fields.sortOrder = "Order must be a whole number.";
  if (Object.keys(fields).length) return fail(fields);

  let image = existing?.image ?? null;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    const up = await saveUploads([file]);
    if ("error" in up) return fail({ image: up.error });
    image = up.urls[0];
  } else if (flag(form, "removeImage")) {
    image = null;
  }

  const data = { name, slug, parentId, icon, image, sortOrder, showInMenu: flag(form, "showInMenu"), description: text(form, "description", 300) || null };
  if (id) await db.category.update({ where: { id }, data });
  else await db.category.create({ data });
  if (existing?.image && existing.image !== image) await deleteUploads([existing.image]); // catalog photos under /media are never deleted
  refreshCatalog();
  return { ok: `Category “${name}” saved.` + (existing && existing.slug !== slug ? " Its URL changed: old links to it no longer work." : "") };
}

/** Only empty categories can be deleted (move products and subcategories first). */
export async function deleteCategory(id: string) {
  await assertAdmin();
  const c = await db.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true, quotes: true } } } });
  if (!c || c._count.products || c._count.children) return;
  await db.category.delete({ where: { id } }); // quotes keep their text; the link is set to null
  await deleteUploads(c.image ? [c.image] : []);
  refreshCatalog();
}

// ---------- brands ----------

/** Renames a brand on every product. Renaming to an existing brand merges the two. */
export async function renameBrand(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const from = text(form, "from", 80);
  const to = text(form, "to", 80).replace(/\s+/g, " ");
  if (!to) return fail({ to: "Enter the new brand name." });
  if (from === to) return { ok: "Nothing changed." };
  const merging = (await db.product.count({ where: { brand: to } })) > 0;
  const res = await db.product.updateMany({ where: { brand: from }, data: { brand: to } });
  refreshCatalog();
  revalidatePath("/admin/brands");
  return { ok: `${res.count} product${res.count === 1 ? "" : "s"} moved from “${from}” to “${to}”${merging ? " (merged with the existing brand)" : ""}.` };
}

// ---------- product options (variants) and bulk tiers ----------

/**
 * Saves a product's option group (e.g. "Memory / Storage": 16 GB +$0, 32 GB +$180). Existing options keep
 * their id (carts and past orders stay linked); options removed from the list are deleted.
 */
export async function saveProductOptions(productId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const product = await db.product.findUnique({ where: { id: productId }, select: { slug: true, variants: { select: { id: true } } } });
  if (!product) return { error: "This product no longer exists." };
  const attribute = text(form, "attribute", 60);
  const ids = form.getAll("v.id").map(String);
  const names = form.getAll("v.name").map((v) => String(v).trim().slice(0, 80));
  const deltas = form.getAll("v.delta").map((v) => String(v).trim());
  const skus = form.getAll("v.sku").map((v) => String(v).trim().slice(0, 60));
  const rows = names.map((name, i) => ({ id: ids[i] || null, name, delta: deltas[i] === "" ? 0 : Number(deltas[i]), sku: skus[i] || null })).filter((r) => r.name || r.id);

  const fields: Record<string, string> = {};
  if (rows.length && !attribute) fields.attribute = "Give the option group a name (e.g. “Memory / Storage”).";
  if (rows.some((r) => !r.name)) fields.name = "Every option needs a name.";
  if (rows.some((r) => !Number.isFinite(r.delta) || Math.abs(r.delta) >= 1e6)) fields.delta = "Price changes must be amounts (use a minus for cheaper).";
  if (new Set(rows.map((r) => r.name.toLowerCase())).size !== rows.length) fields.name = "Option names must be different.";
  const own = new Set(product.variants.map((v) => v.id));
  if (rows.some((r) => r.id && !own.has(r.id))) return { error: "The options changed meanwhile; please reload." };
  if (Object.keys(fields).length) return fail(fields);

  const keep = new Set(rows.map((r) => r.id).filter(Boolean) as string[]);
  await db.$transaction([
    db.variant.deleteMany({ where: { productId, id: { notIn: [...keep] } } }), // order lines keep their text; the link is set to null
    ...rows.map((r, i) => {
      const data = { attribute, name: r.name, priceDelta: Math.round(r.delta * 100) / 100, sku: r.sku, sortOrder: i };
      return r.id ? db.variant.update({ where: { id: r.id }, data }) : db.variant.create({ data: { ...data, productId } });
    }),
  ]);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/", "layout");
  return { ok: rows.length ? `${rows.length} option${rows.length === 1 ? "" : "s"} saved.` : "Options removed." };
}

/** Bulk pricing: from N units, X % off. Tiers must go up without overlapping; the last may be open-ended. */
export async function savePriceTiers(productId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const product = await db.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) return { error: "This product no longer exists." };
  const mins = form.getAll("t.min").map((v) => String(v).trim());
  const maxs = form.getAll("t.max").map((v) => String(v).trim());
  const pcts = form.getAll("t.pct").map((v) => String(v).trim());
  const tiers = mins
    .map((min, i) => ({ min: Number(min), max: maxs[i] === "" ? null : Number(maxs[i]), pct: Number(pcts[i]), empty: !min && !maxs[i] && !pcts[i] }))
    .filter((t) => !t.empty)
    .sort((a, b) => a.min - b.min);

  for (const [i, t] of tiers.entries()) {
    const n = i + 1;
    if (!Number.isInteger(t.min) || t.min < 1) return fail({ tiers: `Tier ${n}: “from” must be a whole number of units.` });
    if (t.max != null && (!Number.isInteger(t.max) || t.max < t.min)) return fail({ tiers: `Tier ${n}: “to” must be empty or at least “from”.` });
    if (!Number.isFinite(t.pct) || t.pct < 0 || t.pct > 90) return fail({ tiers: `Tier ${n}: discount must be 0–90 %.` });
    const next = tiers[i + 1];
    if (next && (t.max == null || t.max >= next.min)) return fail({ tiers: `Tier ${n} overlaps tier ${n + 1}: give it a “to” below ${next.min}.` });
  }
  await db.$transaction([
    db.priceTier.deleteMany({ where: { productId } }),
    db.priceTier.createMany({
      data: tiers.map((t) => ({ productId, minQty: t.min, maxQty: t.max, multiplier: Math.round((1 - t.pct / 100) * 1000) / 1000 })),
    }),
  ]);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/", "layout"); // "Bulk pricing" badges on cards
  return { ok: tiers.length ? `${tiers.length} bulk tier${tiers.length === 1 ? "" : "s"} saved.` : "Bulk pricing removed." };
}

// ---------- CSV import ----------

export type ImportState = {
  error?: string;
  ok?: string;
  applied?: boolean;
  counts?: { create: number; update: number; unchanged: number; error: number };
  unknown?: string[];
  rows?: { line: number; action: string; key: string; name: string; errors: string[]; changes: string[] }[];
};

/** Preview (mode=preview) or write (mode=apply) a product CSV. Rows with errors are never written. */
export async function importProducts(_: ImportState, form: FormData): Promise<ImportState> {
  await assertAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 2 * 1024 * 1024) return { error: "The file is larger than 2 MB; split it into smaller files." };
  const { planImport, applyImport } = await import("@/lib/product-import");
  const plan = await planImport(await file.text());
  if ("error" in plan) return { error: plan.error };

  const shown = plan.rows.filter((r) => r.action !== "unchanged").slice(0, 200);
  const summary = { counts: plan.counts, unknown: plan.unknown, rows: shown.map(({ line, action, key, name, errors, changes }) => ({ line, action, key, name, errors, changes })) };
  if (form.get("mode") !== "apply") return summary;

  const written = await applyImport(plan);
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  return {
    ...summary,
    applied: true,
    ok: `Imported: ${plan.counts.create} created, ${plan.counts.update} updated${plan.counts.error ? `, ${plan.counts.error} rows with errors skipped` : ""}. (${written} products written.)`,
  };
}
