// Product attributes (Phase 16): definitions and their options. Every change goes through here; each function
// checks the actor's permission itself (the server actions in src/app/actions/attributes.ts only wrap them).
import { AttributeType, Prisma } from "@/generated/prisma/client";
import { can, type AdminAccess } from "@/lib/acl";
import { parseBoolean, parseMoney, parseText } from "@/lib/data-transfer/values";
import { db } from "@/lib/db";

export type Result = { ok?: string; error?: string; fields?: Record<string, string>; id?: string };

export const ATTRIBUTE_TYPES: Record<AttributeType, { label: string; hint: string; options: boolean; unit: boolean }> = {
  TEXT: { label: "Text", hint: "One line, e.g. a model number", options: false, unit: false },
  TEXTAREA: { label: "Text area", hint: "Several lines", options: false, unit: false },
  NUMBER: { label: "Number", hint: "e.g. 15.6 (with an optional unit like “in”)", options: false, unit: true },
  BOOLEAN: { label: "Yes / No", hint: "e.g. Backlit keyboard", options: false, unit: false },
  SELECT: { label: "Dropdown (one choice)", hint: "e.g. RAM: 8 GB, 16 GB, 32 GB", options: true, unit: false },
  MULTISELECT: { label: "Multiple choice", hint: "e.g. Ports: USB-C, HDMI, Ethernet", options: true, unit: false },
  DATE: { label: "Date", hint: "e.g. release date", options: false, unit: false },
  PRICE: { label: "Price", hint: "An amount in the store currency", options: false, unit: false },
};

/** For the type picker (plain objects, safe to pass to the browser). */
export const attributeTypeList = () => Object.entries(ATTRIBUTE_TYPES).map(([value, t]) => ({ value, ...t }));

export const isAttributeType = (t: string): t is AttributeType => Object.hasOwn(ATTRIBUTE_TYPES, t);

export const CODE = /^[a-z][a-z0-9_]{1,39}$/;

/** Names of the built-in product fields and import columns; an attribute can't take them. */
export const RESERVED_CODES = new Set([
  "id",
  "sku",
  "name",
  "brand",
  "category",
  "price",
  "compare_at_price",
  "stock",
  "status",
  "description",
  "slug",
  "url_slug",
  "seo_title",
  "seo_description",
  "image",
  "gallery",
  "availability",
  "condition",
  "attribute_set",
]);

export const MAX_OPTIONS = 500;

/** Checks and normalises a default value for the type. "" = no default. */
export function checkDefault(type: AttributeType, raw: string): { value: string | null } | { error: string } {
  const v = raw.trim();
  if (!v) return { value: null };
  switch (type) {
    case "TEXT":
    case "TEXTAREA": {
      const r = parseText(v, "Default value", type === "TEXT" ? 255 : 2000);
      return r.error !== undefined ? { error: r.error } : { value: r.value };
    }
    case "NUMBER": {
      if (!/^-?\d+(\.\d+)?$/.test(v) || Math.abs(Number(v)) >= 1e12) return { error: "Default value must be a number, e.g. 15.6." };
      return { value: String(Number(v)) };
    }
    case "PRICE": {
      const r = parseMoney(v, "Default value");
      return r.error !== undefined ? { error: r.error } : { value: r.value.toFixed(2) };
    }
    case "BOOLEAN": {
      const r = parseBoolean(v, "Default value");
      return r.error !== undefined ? { error: r.error } : { value: r.value ? "yes" : "no" };
    }
    case "DATE": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
        return { error: "Default value must be a date (YYYY-MM-DD)." };
      }
      return { value: v };
    }
    default:
      return { error: "Dropdown and multiple-choice attributes set their default on the options." };
  }
}

/**
 * Where an attribute or option is used. Phase 16 has no product values yet, so nothing is in use;
 * Phase 17 (attribute sets and product values) adds its counts here, and every delete goes through this.
 */
export async function attributeUsage(attributeId: string, optionIds: string[] = []) {
  void attributeId;
  void optionIds;
  return { products: 0, sets: 0, optionProducts: new Map<string, number>() };
}

export type AttributeInput = {
  code?: string;
  name: string;
  type?: string;
  required: boolean;
  defaultValue: string;
  unit: string;
  active: boolean;
  sortOrder: string;
  description: string;
  showOnProduct: boolean;
};

export async function saveAttribute(actor: AdminAccess, id: string | null, input: AttributeInput): Promise<Result> {
  const needed = id ? "attributes.edit" : "attributes.create";
  if (!can(actor, needed)) return { error: `You don't have permission for this (${needed}).` };
  const current = id ? await db.attribute.findUnique({ where: { id } }) : null;
  if (id && !current) return { error: "This attribute no longer exists." };

  const fields: Record<string, string> = {};
  const code = current?.code ?? (input.code ?? "").trim().toLowerCase();
  const type = current?.type ?? (input.type ?? "");
  if (!current) {
    if (!CODE.test(code)) fields.code = "2–40 characters: lowercase letters, numbers and _, starting with a letter (e.g. screen_size).";
    else if (RESERVED_CODES.has(code)) fields.code = `“${code}” is a built-in product field; choose another code.`;
    if (!isAttributeType(type)) fields.type = "Choose an input type.";
  }
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) fields.name = "Name is required (max 80 characters).";
  const nameText = parseText(name, "Name", 80);
  if (nameText.error !== undefined) fields.name = nameText.error;
  const sortOrder = input.sortOrder.trim() === "" ? 0 : Number(input.sortOrder);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100_000) fields.sortOrder = "Sort order must be a whole number.";
  const description = parseText(input.description, "Description", 500);
  if (description.error !== undefined) fields.description = description.error;
  const unitText = parseText(input.unit, "Unit", 20);
  if (unitText.error !== undefined) fields.unit = unitText.error;
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };

  const t = type as AttributeType;
  let defaultValue: string | null = null;
  if (!ATTRIBUTE_TYPES[t].options) {
    const d = checkDefault(t, input.defaultValue);
    if ("error" in d) return { error: d.error, fields: { defaultValue: d.error } };
    defaultValue = d.value;
  }

  const clash = await db.attribute.findFirst({
    where: { OR: [{ code }, { name: { equals: name, mode: "insensitive" } }], ...(id ? { id: { not: id } } : {}) },
    select: { code: true },
  });
  if (clash) {
    return clash.code === code
      ? { error: "An attribute with this code already exists.", fields: { code: "Already used." } }
      : { error: "An attribute with this name already exists.", fields: { name: "Already used." } };
  }

  const data = {
    name,
    required: input.required,
    defaultValue,
    unit: ATTRIBUTE_TYPES[t].unit ? unitText.value || null : null,
    active: input.active,
    sortOrder,
    description: description.value || null,
    showOnProduct: input.showOnProduct,
  };
  try {
    const saved = current ? await db.attribute.update({ where: { id: current.id }, data }) : await db.attribute.create({ data: { ...data, code, type: t } });
    return { ok: current ? "Attribute saved." : "Attribute created.", id: saved.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "An attribute with this code already exists.", fields: { code: "Already used." } };
    throw e;
  }
}

export async function setAttributeActive(actor: AdminAccess, id: string, active: boolean): Promise<Result> {
  if (!can(actor, "attributes.edit")) return { error: "You don't have permission for this (attributes.edit)." };
  const res = await db.attribute.updateMany({ where: { id }, data: { active } });
  return res.count ? { ok: active ? "Attribute enabled." : "Attribute disabled." } : { error: "This attribute no longer exists." };
}

export async function deleteAttribute(actor: AdminAccess, id: string): Promise<Result> {
  if (!can(actor, "attributes.delete")) return { error: "You don't have permission for this (attributes.delete)." };
  const attr = await db.attribute.findUnique({ where: { id }, select: { name: true } });
  if (!attr) return { error: "This attribute no longer exists." };
  const used = await attributeUsage(id);
  if (used.products || used.sets) {
    return { error: `“${attr.name}” is used by ${used.products} product(s) and ${used.sets} attribute set(s). Disable it instead, or remove it from them first.` };
  }
  await db.attribute.delete({ where: { id } }); // options go with it (cascade)
  return { ok: `Attribute “${attr.name}” deleted.` };
}

export type OptionRow = { id: string; label: string; active: boolean; isDefault: boolean };

/**
 * Saves the full option list in the given order: new rows (no id) are added, existing ones renamed, enabled or
 * disabled and re-ordered, and options left out are deleted (only when no product uses them).
 */
export async function saveOptions(actor: AdminAccess, attributeId: string, rows: OptionRow[]): Promise<Result> {
  if (!can(actor, "attributes.edit")) return { error: "You don't have permission for this (attributes.edit)." };
  const attr = await db.attribute.findUnique({ where: { id: attributeId }, include: { options: { select: { id: true, label: true } } } });
  if (!attr) return { error: "This attribute no longer exists." };
  if (!ATTRIBUTE_TYPES[attr.type].options) return { error: "Only dropdown and multiple-choice attributes have options." };

  const clean = rows.map((r) => ({ ...r, label: r.label.trim().replace(/\s+/g, " ") })).filter((r) => r.label || r.id);
  if (clean.length > MAX_OPTIONS) return { error: `At most ${MAX_OPTIONS} options.` };
  for (const r of clean) {
    const t = parseText(r.label, "Option", 100);
    if (!r.label) return { error: "Every option needs a label (or remove it)." };
    if (t.error !== undefined) return { error: `“${r.label.slice(0, 30)}…”: ${t.error}` };
  }
  const labels = clean.map((r) => r.label.toLowerCase());
  const dup = labels.find((l, i) => labels.indexOf(l) !== i);
  if (dup) return { error: `The option “${clean[labels.indexOf(dup)].label}” is listed twice.` };
  const own = new Set(attr.options.map((o) => o.id));
  if (clean.some((r) => r.id && !own.has(r.id))) return { error: "The options changed meanwhile; please reload." };
  const defaults = clean.filter((r) => r.isDefault);
  if (attr.type === "SELECT" && defaults.length > 1) return { error: "A dropdown can have only one default option." };
  if (defaults.some((r) => !r.active)) return { error: "A disabled option can't be the default." };

  const keep = new Set(clean.map((r) => r.id).filter(Boolean));
  const removed = attr.options.filter((o) => !keep.has(o.id));
  if (removed.length) {
    const usage = await attributeUsage(attributeId, removed.map((o) => o.id));
    const inUse = removed.filter((o) => (usage.optionProducts.get(o.id) ?? 0) > 0);
    if (inUse.length) return { error: `${inUse.map((o) => `“${o.label}”`).join(", ")} is used by products; disable it instead of removing it.` };
  }

  await db.$transaction(async (tx) => {
    await tx.attributeOption.deleteMany({ where: { attributeId, id: { in: removed.map((o) => o.id) } } });
    // Temporary labels first, so swapping two labels doesn't hit the unique (attribute, label) index.
    for (const r of clean.filter((r) => r.id)) await tx.attributeOption.update({ where: { id: r.id }, data: { label: `__reorder__${r.id}` } });
    for (const [i, r] of clean.entries()) {
      const data = { label: r.label, active: r.active, isDefault: r.isDefault, sortOrder: i };
      if (r.id) await tx.attributeOption.update({ where: { id: r.id }, data });
      else await tx.attributeOption.create({ data: { ...data, attributeId } });
    }
  });
  return { ok: `${clean.length} option${clean.length === 1 ? "" : "s"} saved.` };
}
