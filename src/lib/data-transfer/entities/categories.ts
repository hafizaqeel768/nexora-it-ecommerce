// Categories for Data Transfer (Phase 15). Two levels like Admin → Categories: top-level categories and their
// subcategories. Rows match by URL name. A parent can be an existing top-level category or one added earlier
// in the same file (parents are written first).
import type { Prisma } from "@/generated/prisma/client";
import type { ExportAdapter, ImportAdapter, PlannedRow } from "@/lib/data-transfer/types";
import { parseBoolean, parseInteger, parseText, SLUG, slugify } from "@/lib/data-transfer/values";
import { db } from "@/lib/db";

type Existing = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  description: string | null;
  showInMenu: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  _count: { children: number };
};
type Ctx = {
  bySlug: Map<string, Existing>;
  byId: Map<string, Existing>;
  seen: Map<string, number>;
  /** Slugs this file makes top-level / subcategories (for parent checks between rows) */
  fileTop: Set<string>;
  fileChild: Set<string>;
  usedAsParent: Set<string>;
};
/** parentSlug: undefined = leave as is, null = top-level */
type Write = { id?: string; slug: string; parentSlug: string | null | undefined; data: Omit<Prisma.CategoryUncheckedCreateInput, "parentId" | "slug"> };

export const categoryImport: ImportAdapter<Ctx, Write> = {
  entity: "categories",
  label: "Categories",
  permission: "categories.import",
  behaviors: ["add", "update", "add_update"],
  columns: [
    { key: "url_name", header: "URL name", aliases: ["slug", "url slug", "url key"], required: "key", type: "text", description: "Lowercase letters, numbers and dashes; finds existing categories. New ones get it from the name when empty.", example: "switches" },
    { key: "name", header: "Name", required: "create", type: "text", description: "Category name (max 80 characters).", example: "Switches" },
    { key: "parent", header: "Parent", required: false, type: "reference", description: "URL name or name of a top-level category. Empty = top-level. Only two levels.", example: "networking" },
    { key: "description", header: "Description", required: false, type: "text", description: "Shown on the category page (max 2000).", example: "Managed and unmanaged switches." },
    { key: "show_in_menu", header: "Show in menu", required: false, type: "boolean", values: ["yes", "no"], description: "Top-level categories only: listed in the header menu, footer and home tiles. New: yes.", example: "yes" },
    { key: "sort_order", header: "Sort order", required: false, type: "integer", description: "Lower numbers come first. New: 0.", example: "10" },
    { key: "seo_title", header: "SEO title", required: false, type: "text", description: "Page title for search engines (max 200).", example: "" },
    { key: "seo_description", header: "SEO description", required: false, type: "text", description: "Meta description (max 400).", example: "" },
    { key: "products", header: "Products", required: false, type: "integer", description: "Number of products (export only; ignored on import).", example: "", exportOnly: true },
  ],
  notes: [
    "Rows are matched by URL name. Only the columns in the file are changed.",
    "A subcategory's parent must be a top-level category. A category that has subcategories can't become a subcategory.",
    "Images and icons are not imported; set them in Admin → Categories. Categories are never deleted by an import.",
  ],
  sample: [
    { url_name: "networking-gear", name: "Networking Gear", parent: "", description: "Everything for your network.", show_in_menu: "yes", sort_order: "10" },
    { url_name: "poe-switches", name: "PoE Switches", parent: "networking-gear", description: "Switches that power devices.", show_in_menu: "yes", sort_order: "1" },
  ],

  async load() {
    const all = await db.category.findMany({
      select: { id: true, slug: true, name: true, parentId: true, description: true, showInMenu: true, sortOrder: true, seoTitle: true, seoDescription: true, _count: { select: { children: true } } },
    });
    return { bySlug: new Map(all.map((c) => [c.slug, c])), byId: new Map(all.map((c) => [c.id, c])), seen: new Map(), fileTop: new Set(), fileChild: new Set(), usedAsParent: new Set() };
  },

  plan(row, ctx, behavior) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const out = (action: PlannedRow<Write>["action"], key: string, extra: Partial<PlannedRow<Write>> = {}): PlannedRow<Write> => ({ line: row.line, key, action, errors, warnings, changes: [], ...extra });
    const text = (k: string, label: string, max: number) => {
      const v = row.get(k);
      if (v === undefined) return undefined;
      const r = parseText(v, label, max);
      if (r.error !== undefined) errors.push(r.error);
      return r.value;
    };

    const nameCell = text("name", "Name", 80);
    let slug = (row.get("url_name") ?? "").toLowerCase();
    if (slug && !SLUG.test(slug)) return out("skip", slug, { errors: [`URL name “${slug}” may only contain lowercase letters, numbers and dashes.`] });
    if (!slug && behavior === "update") return out("skip", nameCell || `row ${row.line}`, { errors: ["URL name is required to find the category to update."] });
    if (!slug && nameCell) slug = slugify(nameCell, "category");
    if (!slug) return out("skip", `row ${row.line}`, { errors: ["Name or URL name is required."] });
    const key = slug;

    const earlier = ctx.seen.get(slug);
    if (earlier) return out("skip", key, { errors: [`Duplicate: URL name ${slug} is already in row ${earlier}.`] });
    ctx.seen.set(slug, row.line);

    const cur = ctx.bySlug.get(slug);
    if (cur && behavior === "add") return out("skip", key, { warnings: ["Already exists; skipped (behavior: Add)."] });
    if (!cur && behavior === "update") return out("skip", key, { warnings: ["No category with this URL name; skipped (behavior: Update)."] });

    const name = nameCell || cur?.name || "";
    if (!name) errors.push("Name is required.");

    // Parent: undefined = column absent (keep), "" = top-level.
    let parentSlug: string | null | undefined;
    const parentCell = row.get("parent");
    if (parentCell !== undefined) {
      if (parentCell === "") parentSlug = null;
      else {
        const v = parentCell.toLowerCase();
        const existing = ctx.bySlug.get(v) ?? [...ctx.bySlug.values()].find((c) => c.name.toLowerCase() === v);
        const inFile = ctx.fileTop.has(v) ? v : null;
        const p = existing?.slug ?? inFile;
        if (!p) errors.push(`Parent “${parentCell}” not found (it must exist or come earlier in this file as a top-level category).`);
        else if (p === slug) errors.push("A category can't be its own parent.");
        else if (ctx.fileChild.has(p) || (existing?.parentId && !ctx.fileTop.has(p))) errors.push(`Parent “${parentCell}” is a subcategory; only two levels are allowed.`);
        else parentSlug = p;
      }
    }
    const becomesChild = parentSlug !== undefined ? parentSlug !== null : !!cur?.parentId;
    if (becomesChild && (cur?._count.children || ctx.usedAsParent.has(slug))) errors.push("This category has subcategories, so it can't become a subcategory.");
    if (becomesChild) ctx.fileChild.add(slug);
    else ctx.fileTop.add(slug);
    if (parentSlug) ctx.usedAsParent.add(parentSlug);

    let showInMenu: boolean | undefined;
    const menu = row.get("show_in_menu");
    if (menu) {
      const r = parseBoolean(menu, "Show in menu");
      if (r.error !== undefined) errors.push(r.error);
      else showInMenu = r.value;
    }
    let sortOrder: number | undefined;
    const so = row.get("sort_order");
    if (so) {
      const r = parseInteger(so, "Sort order", -100_000, 100_000);
      if (r.error !== undefined) errors.push(r.error);
      else sortOrder = r.value;
    }
    const description = text("description", "Description", 2000);
    const seoTitle = text("seo_title", "SEO title", 200);
    const seoDescription = text("seo_description", "SEO description", 400);
    if (errors.length) return out(cur ? "update" : "create", key);

    const data: Write["data"] = {
      name,
      ...(description !== undefined && { description: description || null }),
      ...(showInMenu !== undefined && { showInMenu }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(seoTitle !== undefined && { seoTitle: seoTitle || null }),
      ...(seoDescription !== undefined && { seoDescription: seoDescription || null }),
    };
    if (!cur) return out("create", key, { changes: [parentSlug ? `under ${parentSlug}` : "top-level"], write: { slug, parentSlug: parentSlug ?? null, data } });

    const curParent = cur.parentId ? (ctx.byId.get(cur.parentId)?.slug ?? null) : null;
    const changes: string[] = [];
    if (name !== cur.name) changes.push("name");
    if (parentSlug !== undefined && parentSlug !== curParent) changes.push(parentSlug ? `moved under ${parentSlug}` : "made top-level");
    if (description !== undefined && (description || null) !== cur.description) changes.push("description");
    if (showInMenu !== undefined && showInMenu !== cur.showInMenu) changes.push(showInMenu ? "shown in menu" : "hidden from menu");
    if (sortOrder !== undefined && sortOrder !== cur.sortOrder) changes.push(`sort order ${cur.sortOrder} → ${sortOrder}`);
    if (seoTitle !== undefined && (seoTitle || null) !== cur.seoTitle) changes.push("SEO title");
    if (seoDescription !== undefined && (seoDescription || null) !== cur.seoDescription) changes.push("SEO description");
    if (!changes.length) return out("skip", key);
    return out("update", key, { changes, write: { id: cur.id, slug, parentSlug, data } });
  },

  // New top-level categories first, so subcategories in the same file find their parent.
  sortForWrite: (rows) => [...rows].sort((a, b) => Number(!!a.write?.parentSlug) - Number(!!b.write?.parentSlug)),

  async write(tx, w, action) {
    let parentId: string | null | undefined;
    if (w.parentSlug === null) parentId = null;
    else if (w.parentSlug) {
      const parent = await tx.category.findUnique({ where: { slug: w.parentSlug }, select: { id: true, parentId: true } });
      if (!parent) throw new Error(`Parent ${w.parentSlug} not found`);
      if (parent.parentId) throw new Error(`Parent ${w.parentSlug} is a subcategory`);
      parentId = parent.id;
    }
    if (action === "create") await tx.category.create({ data: { ...w.data, slug: w.slug, parentId: parentId ?? null } });
    else {
      if (parentId && (await tx.category.count({ where: { parentId: w.id } }))) throw new Error("Category has subcategories");
      await tx.category.update({ where: { id: w.id }, data: { ...w.data, ...(parentId !== undefined && { parentId }) } });
    }
  },
};

// ---------- export ----------

type Filters = { menu: "shown" | "hidden" | null; level: "top" | "sub" | null; parentId: string | null };

const where = (f: Filters): Prisma.CategoryWhereInput => ({
  ...(f.menu ? { showInMenu: f.menu === "shown" } : {}),
  ...(f.level === "top" ? { parentId: null } : f.level === "sub" ? { parentId: { not: null } } : {}),
  ...(f.parentId ? { parentId: f.parentId } : {}),
});

export const categoryExport: ExportAdapter<Filters> = {
  entity: "categories",
  label: "Categories",
  permission: "categories.export",
  filters: [
    { key: "menu", label: "Status", type: "choice", options: [{ value: "", label: "Any" }, { value: "shown", label: "Shown in menu" }, { value: "hidden", label: "Hidden from menu" }] },
    { key: "level", label: "Level", type: "choice", options: [{ value: "", label: "All" }, { value: "top", label: "Top-level only" }, { value: "sub", label: "Subcategories only" }] },
    { key: "parent", label: "Parent (URL name)", type: "text", placeholder: "subcategories of…" },
  ],
  async parseFilters(p) {
    const errors: string[] = [];
    const menu = p.get("menu");
    const level = p.get("level");
    const parent = (p.get("parent") ?? "").trim().toLowerCase();
    let parentId: string | null = null;
    if (parent) {
      const c = await db.category.findUnique({ where: { slug: parent }, select: { id: true } });
      if (!c) errors.push(`Parent “${parent}” not found.`);
      parentId = c?.id ?? "none";
    }
    return {
      filters: { menu: menu === "shown" || menu === "hidden" ? menu : null, level: level === "top" || level === "sub" ? level : null, parentId },
      errors,
    };
  },
  count: (f) => db.category.count({ where: where(f) }),
  headers: categoryImport.columns.map((c) => c.header),
  async page(f, cursor, take) {
    const rows = await db.category.findMany({
      where: where(f),
      orderBy: { id: "asc" },
      take,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { parent: { select: { slug: true } }, _count: { select: { products: true } } },
    });
    return {
      last: rows.at(-1)?.id ?? null,
      rows: rows.map((c) => [c.slug, c.name, c.parent?.slug ?? "", c.description, c.showInMenu ? "yes" : "no", c.sortOrder, c.seoTitle, c.seoDescription, c._count.products]),
    };
  },
};
