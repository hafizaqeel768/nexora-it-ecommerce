"use server";

// Settings actions (Phase 11). Every action checks the admin role itself and validates its input;
// saved values go through mergeDefaults, so unknown keys or wrong types never reach the storefront.
import { revalidatePath } from "next/cache";
import type { AdminFormState } from "@/app/actions/admin";
import { ShippingKind } from "@/generated/prisma/client";
import { assertAdmin } from "@/lib/admin";
import { getConfig, saveConfig } from "@/lib/config";
import { EMAIL_TEMPLATE_INFO, type EmailTemplateKey, type PaymentSettings } from "@/lib/config-shared";
import { isCountryCode, stateKey } from "@/lib/countries";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { testEmail } from "@/lib/email-templates";
import { deleteUploads, saveUploads } from "@/lib/uploads";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
const flag = (form: FormData, key: string) => form.get(key) === "on";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s<>"]+$/i;

/** "" → null; otherwise an amount ≥ 0 with 2 decimals, or undefined when invalid. */
function amount(value: string): number | null | undefined {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1e8 ? Math.round(n * 100) / 100 : undefined;
}

function fail(fields: Record<string, string>): AdminFormState {
  return { error: `Please check: ${Object.values(fields).join(" ")}`, fields };
}

function refresh(path: string) {
  revalidatePath("/", "layout"); // header, footer, checkout, titles
  revalidatePath(path);
}

// ---------- search engines (Phase 17) ----------

/** Accepts the code or the whole <meta … content="code"> tag that Google/Bing show. */
function verificationCode(value: string) {
  const code = value.match(/content=["']([^"']+)["']/i)?.[1] ?? value;
  return code.trim();
}

export async function saveSeoSettings(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const current = await getConfig("seo");
  const v = {
    homeTitle: text(form, "homeTitle", 120),
    homeDescription: text(form, "homeDescription", 320),
    allowIndexing: flag(form, "allowIndexing"),
    googleVerification: verificationCode(text(form, "googleVerification", 300)),
    bingVerification: verificationCode(text(form, "bingVerification", 300)),
  };
  const fields: Record<string, string> = {};
  for (const k of ["googleVerification", "bingVerification"] as const) {
    if (v[k] && !/^[\w-]{6,100}$/.test(v[k])) fields[k] = `The ${k === "googleVerification" ? "Google" : "Bing"} code should be the letters and numbers from the meta tag.`;
  }
  if (Object.keys(fields).length) return fail(fields);

  let shareImage = current.shareImage;
  const file = form.get("shareImage");
  if (file instanceof File && file.size > 0) {
    const up = await saveUploads([file]);
    if ("error" in up) return fail({ shareImage: up.error });
    shareImage = up.urls[0];
  } else if (flag(form, "removeShareImage")) {
    shareImage = null;
  }
  await saveConfig("seo", { ...v, shareImage });
  if (current.shareImage && current.shareImage !== shareImage) await deleteUploads([current.shareImage]);
  refresh("/admin/settings/seo");
  return { ok: v.allowIndexing ? "SEO settings saved." : "SEO settings saved. Search engines are now asked not to index the store." };
}

// ---------- store details ----------

export async function saveStoreDetails(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const current = await getConfig("store");
  const v = {
    name: text(form, "name", 80),
    logoText: text(form, "logoText", 30),
    logoAccent: text(form, "logoAccent", 15),
    tagline: text(form, "tagline", 120),
    announcement: text(form, "announcement", 160),
    supportEmail: text(form, "supportEmail", 200),
    salesEmail: text(form, "salesEmail", 200),
    phone: text(form, "phone", 40),
    address: text(form, "address", 400),
    footerAbout: text(form, "footerAbout", 400),
    copyright: text(form, "copyright", 160),
    social: { linkedin: text(form, "linkedin", 300), x: text(form, "x", 300), facebook: text(form, "facebook", 300), youtube: text(form, "youtube", 300) },
  };
  const fields: Record<string, string> = {};
  if (!v.name) fields.name = "Store name is required.";
  if (!v.logoText && !current.logoUrl) fields.logoText = "Logo text is required when there is no logo image.";
  for (const k of ["supportEmail", "salesEmail"] as const) if (v[k] && !EMAIL.test(v[k])) fields[k] = `${k === "supportEmail" ? "Support" : "Sales"} email is not valid.`;
  for (const [k, url] of Object.entries(v.social)) if (url && !URL_RE.test(url)) fields[k] = `The ${k} link must start with https://.`;
  if (Object.keys(fields).length) return fail(fields);

  let logoUrl = current.logoUrl;
  const file = form.get("logo");
  if (file instanceof File && file.size > 0) {
    const up = await saveUploads([file]);
    if ("error" in up) return fail({ logo: up.error });
    logoUrl = up.urls[0];
  } else if (flag(form, "removeLogo")) {
    logoUrl = null;
  }
  await saveConfig("store", { ...v, logoUrl });
  if (current.logoUrl && current.logoUrl !== logoUrl) await deleteUploads([current.logoUrl]);
  refresh("/admin/settings");
  return { ok: "Store details saved." };
}

// ---------- checkout & stock ----------

export async function saveCheckoutSettings(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const minOrder = amount(text(form, "minOrder", 20));
  const lowStockAt = Number(text(form, "lowStockAt", 10));
  const defaultCountry = text(form, "defaultCountry", 2).toUpperCase();
  const fields: Record<string, string> = {};
  if (minOrder === undefined) fields.minOrder = "Minimum order must be an amount (0 = none).";
  if (!Number.isInteger(lowStockAt) || lowStockAt < 0 || lowStockAt > 100000) fields.lowStockAt = "Low-stock alert must be a whole number.";
  if (!isCountryCode(defaultCountry)) fields.defaultCountry = "Choose a default country.";
  if (Object.keys(fields).length) return fail(fields);
  await saveConfig("checkout", {
    guestCheckout: flag(form, "guestCheckout"),
    minOrder: minOrder ?? 0,
    requirePhone: flag(form, "requirePhone"),
    showNotes: flag(form, "showNotes"),
    defaultCountry,
  });
  await saveConfig("inventory", { lowStockAt });
  refresh("/admin/settings/checkout");
  return { ok: "Checkout & stock settings saved." };
}

// ---------- payments ----------

export async function savePayments(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const keys = ["card", "purchaseOrder", "bankTransfer"] as const;
  const next = Object.fromEntries(
    keys.map((k) => [k, { enabled: flag(form, `${k}.enabled`), label: text(form, `${k}.label`, 60), instructions: text(form, `${k}.instructions`, 1500) }]),
  ) as PaymentSettings;
  const fields: Record<string, string> = {};
  for (const k of keys) if (!next[k].label) fields[`${k}.label`] = "Every payment method needs a label.";
  if (!keys.some((k) => next[k].enabled)) fields.enabled = "Keep at least one payment method switched on.";
  if (Object.keys(fields).length) return fail(fields);
  await saveConfig("payments", next);
  refresh("/admin/settings/payments");
  return { ok: "Payment settings saved." };
}

// ---------- email ----------

export async function saveEmailSettings(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const senderEmail = text(form, "senderEmail", 200);
  const replyTo = text(form, "replyTo", 200);
  const fields: Record<string, string> = {};
  if (senderEmail && !EMAIL.test(senderEmail)) fields.senderEmail = "Sender email is not valid.";
  if (replyTo && !EMAIL.test(replyTo)) fields.replyTo = "Reply-to email is not valid.";
  const templates = Object.fromEntries(
    (Object.keys(EMAIL_TEMPLATE_INFO) as EmailTemplateKey[]).map((k) => {
      const subject = text(form, `${k}.subject`, 160);
      if (!subject) fields[`${k}.subject`] = `“${EMAIL_TEMPLATE_INFO[k].label}” needs a subject.`;
      return [k, { subject, intro: text(form, `${k}.intro`, 1500) }];
    }),
  ) as Record<EmailTemplateKey, { subject: string; intro: string }>;
  if (Object.keys(fields).length) return fail(fields);
  await saveConfig("email", { senderName: text(form, "senderName", 80), senderEmail, replyTo, templates });
  refresh("/admin/settings/email");
  return { ok: "Email settings saved." };
}

export async function sendTestEmail(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await assertAdmin();
  const key = text(form, "template", 40) as EmailTemplateKey;
  if (!(key in EMAIL_TEMPLATE_INFO)) return { error: "Choose an email." };
  const res = await sendMail(await testEmail(key, admin.email));
  return res.ok ? { ok: `Test email sent to ${admin.email}.` } : { error: `Could not send: ${res.error}` };
}

// ---------- shipping ----------

export async function saveShippingZone(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const id = text(form, "id", 40) || null;
  const name = text(form, "name", 80);
  const countries = [...new Set(form.getAll("countries").map((c) => String(c).toUpperCase()))].filter(isCountryCode);
  const states = [
    ...new Set(
      text(form, "states", 1000)
        .split(/[,\n]/)
        .map((s) => stateKey(countries[0] ?? "", s))
        .filter(Boolean),
    ),
  ];
  const sortOrder = Number(text(form, "sortOrder", 6) || "0");
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Zone name is required.";
  if (states.length && countries.length !== 1) fields.states = "States can only be set for a zone with exactly one country.";
  if (!Number.isInteger(sortOrder)) fields.sortOrder = "Order must be a whole number.";
  if (Object.keys(fields).length) return fail(fields);
  const data = { name, countries, states, sortOrder };
  if (id) await db.shippingZone.update({ where: { id }, data });
  else await db.shippingZone.create({ data });
  refresh("/admin/settings/shipping");
  return { ok: `Zone “${name}” saved.` };
}

export async function deleteShippingZone(id: string) {
  await assertAdmin();
  await db.shippingZone.deleteMany({ where: { id } }); // its methods go with it
  refresh("/admin/settings/shipping");
}

export async function saveShippingMethod(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const id = text(form, "id", 40) || null;
  const zoneId = text(form, "zoneId", 40);
  const name = text(form, "name", 80);
  const kind = text(form, "kind", 10) === "PICKUP" ? ShippingKind.PICKUP : ShippingKind.FLAT;
  const price = amount(text(form, "price", 20));
  const freeFrom = amount(text(form, "freeFrom", 20));
  const minSubtotal = amount(text(form, "minSubtotal", 20));
  const sortOrder = Number(text(form, "sortOrder", 6) || "0");
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Method name is required.";
  if (price === undefined) fields.price = "Price must be an amount.";
  if (freeFrom === undefined) fields.freeFrom = "“Free from” must be an amount or empty.";
  if (minSubtotal === undefined) fields.minSubtotal = "“Only from” must be an amount or empty.";
  if (!Number.isInteger(sortOrder)) fields.sortOrder = "Order must be a whole number.";
  if (!(await db.shippingZone.findUnique({ where: { id: zoneId }, select: { id: true } }))) fields.zoneId = "The zone no longer exists.";
  if (Object.keys(fields).length) return fail(fields);
  const data = { zoneId, name, kind, price: price ?? 0, freeFrom, minSubtotal, active: flag(form, "active"), sortOrder };
  if (id) await db.shippingMethod.update({ where: { id }, data });
  else await db.shippingMethod.create({ data });
  refresh("/admin/settings/shipping");
  return { ok: `Method “${name}” saved.` };
}

export async function deleteShippingMethod(id: string) {
  await assertAdmin();
  await db.shippingMethod.deleteMany({ where: { id } });
  refresh("/admin/settings/shipping");
}

// ---------- tax ----------

export async function saveTaxRate(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const id = text(form, "id", 40) || null;
  const name = text(form, "name", 80);
  const country = text(form, "country", 2).toUpperCase() || "*";
  const state = country === "*" ? "" : stateKey(country, text(form, "state", 60));
  const rate = Number(text(form, "rate", 10));
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Name is required (shown at checkout, e.g. “Texas sales tax”).";
  if (country !== "*" && !isCountryCode(country)) fields.country = "Choose a country.";
  if (!Number.isFinite(rate) || rate < 0 || rate > 50) fields.rate = "Rate must be between 0 and 50 %.";
  const clash = await db.taxRate.findFirst({ where: { country, state, NOT: id ? { id } : undefined }, select: { id: true } });
  if (clash) fields.country = "There is already a rate for this country/state; edit that one instead.";
  if (Object.keys(fields).length) return fail(fields);
  const data = { name, country, state, rate: Math.round(rate * 1000) / 1000, shipping: flag(form, "shipping") };
  if (id) await db.taxRate.update({ where: { id }, data });
  else await db.taxRate.create({ data });
  refresh("/admin/settings/tax");
  return { ok: `Tax rate “${name}” saved.` };
}

export async function deleteTaxRate(id: string) {
  await assertAdmin();
  await db.taxRate.deleteMany({ where: { id } });
  refresh("/admin/settings/tax");
}

export async function toggleTaxExempt(customerId: string) {
  await assertAdmin();
  const c = await db.customer.findUnique({ where: { id: customerId }, select: { taxExempt: true } });
  if (!c) return;
  await db.customer.update({ where: { id: customerId }, data: { taxExempt: !c.taxExempt } });
  revalidatePath("/admin/customers");
}
