"use server";

// Admin actions. Every action checks the admin role itself (the /admin layout check is not enough:
// server actions can be called directly).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Availability, OrderStatus, Prisma, ProductStatus, QuoteStatus } from "@/generated/prisma/client";
import { assertAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { runEmailJobs } from "@/lib/jobs";
import { deliverOrderEmail, queueOrderEmail } from "@/lib/order-emails";
import { newOrderNumber, restockOrder } from "@/lib/orders";
import { deleteUploads, saveUploads } from "@/lib/uploads";

export type AdminFormState = { error?: string; ok?: string; fields?: Record<string, string> };

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

/** "" → null; otherwise a finite number ≥ 0 with at most 2 decimals, or undefined when invalid. */
function money(value: string): number | null | undefined {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 1e8 ? Math.round(n * 100) / 100 : undefined;
}

function refreshStore(slug?: string) {
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/product/${slug}`);
}

// ---------- products ----------

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.product.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new Error("Could not find a free slug");
}

/** "Label: value" per line → [{ label, value }] (the prototype's specs textarea). */
function parseSpecs(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60)
    .map((line) => {
      const i = line.indexOf(":");
      return i > 0
        ? { label: line.slice(0, i).trim().slice(0, 80), value: line.slice(i + 1).trim().slice(0, 300) }
        : { label: line.slice(0, 80), value: "" };
    });
}

export async function saveProduct(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const id = text(form, "id", 40) || null;
  const existing = id ? await db.product.findUnique({ where: { id }, select: { slug: true, image: true, gallery: true } }) : null;
  if (id && !existing) return { error: "This product no longer exists." };

  const name = text(form, "name", 200);
  const brand = text(form, "brand", 80);
  const categoryId = text(form, "categoryId", 40);
  const price = money(text(form, "price", 20));
  const compareAtPrice = money(text(form, "compareAtPrice", 20));
  const stockRaw = text(form, "stock", 10);
  const stock = stockRaw === "" ? null : Number(stockRaw);
  const sku = text(form, "sku", 60) || null;
  const status = text(form, "status", 10) === "DRAFT" ? ProductStatus.DRAFT : ProductStatus.ACTIVE;
  const availabilityRaw = text(form, "availability", 20);
  const availability = (Object.values(Availability) as string[]).includes(availabilityRaw)
    ? (availabilityRaw as Availability)
    : Availability.IN_STOCK;

  const fields: Record<string, string> = {};
  if (!name) fields.name = "Please enter a name.";
  if (!brand) fields.brand = "Please enter a brand.";
  if (!categoryId || !(await db.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) fields.categoryId = "Please choose a category.";
  if (price == null) fields.price = "Please enter a price (0 or more).";
  if (compareAtPrice === undefined) fields.compareAtPrice = "Please enter a valid amount or leave it empty.";
  else if (compareAtPrice != null && price != null && compareAtPrice <= price) fields.compareAtPrice = "Must be higher than the price (it is shown struck through).";
  if (stock != null && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000)) fields.stock = "Whole number, 0 or more (empty = not tracked).";
  if (sku && (await db.product.findFirst({ where: { sku, NOT: id ? { id } : undefined }, select: { id: true } }))) fields.sku = "Another product already uses this SKU.";
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };

  // Photos: kept ones (only this product's own), in the chosen order, then new uploads.
  const own = new Set([existing?.image, ...(existing?.gallery ?? [])].filter(Boolean) as string[]);
  const kept = form.getAll("keepImage").map(String).filter((u) => own.has(u));
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded = files.length ? await saveUploads(files) : { urls: [] };
  if ("error" in uploaded) return { error: uploaded.error, fields: { photos: uploaded.error } };
  const images = [...kept, ...uploaded.urls];

  const data = {
    name,
    brand,
    categoryId,
    price: price!,
    compareAtPrice,
    stock,
    availability: stock === 0 ? Availability.OUT_OF_STOCK : availability,
    sku,
    status,
    description: text(form, "description", 5000) || null, // what the product page shows
    specs: parseSpecs(text(form, "specs", 10000)),
    image: images[0] ?? null,
    gallery: images.slice(1),
  };

  let saved: { id: string; slug: string };
  try {
    saved = id
      ? await db.product.update({ where: { id }, data, select: { id: true, slug: true } })
      : await db.product.create({ data: { ...data, slug: await uniqueSlug(name) }, select: { id: true, slug: true } });
  } catch (e) {
    await deleteUploads(uploaded.urls);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "SKU or slug already in use." };
    throw e;
  }

  await deleteUploads([...own].filter((u) => !images.includes(u)));
  refreshStore(saved.slug);
  revalidatePath("/admin/products");
  if (!id) redirect(`/admin/products/${saved.id}?created=1`);
  return { ok: "Product saved" };
}

export async function toggleProductStatus(id: string) {
  await assertAdmin();
  const p = await db.product.findUnique({ where: { id }, select: { status: true, slug: true } });
  if (!p) return;
  await db.product.update({ where: { id }, data: { status: p.status === "ACTIVE" ? "DRAFT" : "ACTIVE" } });
  refreshStore(p.slug);
  revalidatePath("/admin/products");
}

// ---------- orders ----------

export async function updateOrderStatus(orderId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const next = text(form, "status", 20) as OrderStatus;
  if (!(Object.values(OrderStatus) as string[]).includes(next)) return { error: "Unknown status." };

  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, email: true, paymentStatus: true } });
    if (!order) return { error: "Order not found." };
    if (order.status === next) return { error: `The order is already ${next.toLowerCase()}.` };
    if (order.status === "CANCELLED") return { error: "Cancelled orders are final (their stock was released)." };
    // Only move if nobody changed it meanwhile; cancelling releases the reserved stock exactly once.
    const res = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: next } });
    if (res.count !== 1) return { error: "The order changed meanwhile; please reload." };
    if (next === "CANCELLED") await restockOrder(tx, orderId);
    const email = await queueOrderEmail(tx, orderId, "STATUS", next, order.email);
    return { ok: `Status set to ${next.toLowerCase()}. Status email to ${order.email} is on its way.`, paid: order.paymentStatus === "PAID", emailId: email.id };
  });
  if ("error" in result) return { error: result.error };
  after(() => deliverOrderEmail(result.emailId));

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/", "layout");
  return { ok: result.ok + (next === "CANCELLED" && result.paid ? " This order was paid: refund it in Stripe/manually." : "") };
}

/** Sends a queued or failed order email again, now. */
export async function retryOrderEmail(emailId: string) {
  await assertAdmin();
  // An admin retry gets a fresh set of attempts.
  const row = await db.orderEmail.update({ where: { id: emailId }, data: { attempts: 0 }, select: { orderId: true, sentAt: true } });
  if (!row.sentAt) await deliverOrderEmail(emailId);
  revalidatePath(`/admin/orders/${row.orderId}`);
}

/** Purchase orders and bank transfers are marked paid by hand; card payments only through Stripe. */
export async function markOrderPaid(orderId: string) {
  await assertAdmin();
  await db.order.updateMany({
    where: { id: orderId, paymentStatus: "UNPAID", paymentMethod: { not: "CREDIT_CARD" }, status: { not: "CANCELLED" } },
    data: { paymentStatus: "PAID" },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

// ---------- quotes ----------

export async function updateQuoteStatus(quoteId: string, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const next = text(form, "status", 20) as QuoteStatus;
  if (!(Object.values(QuoteStatus) as string[]).includes(next)) return { error: "Unknown status." };
  const res = await db.quote.updateMany({ where: { id: quoteId }, data: { status: next } });
  if (res.count !== 1) return { error: "Quote not found." };
  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath("/admin/quotes");
  return { ok: `Status set to ${next.toLowerCase()}.` };
}

/**
 * The prototype's a_convert(): a PENDING purchase-order order with one placeholder line
 * ("Custom quote — Category (qty N)", $0) to be priced with the customer; the quote becomes WON.
 */
export async function convertQuoteToOrder(quoteId: string) {
  await assertAdmin();
  const orderId = await db.$transaction(async (tx) => {
    const q = await tx.quote.findUnique({ where: { id: quoteId }, include: { category: { select: { name: true } } } });
    if (!q) return null;
    if (q.orderId) return q.orderId;
    const number = await newOrderNumber(tx);
    if (!number) throw new Error("Could not create an order number");
    const qty = Math.max(1, Number.parseInt(q.quantity ?? "1", 10) || 1);
    const tbc = "To be confirmed";
    const order = await tx.order.create({
      data: {
        number,
        customerId: q.customerId,
        name: q.name,
        email: q.email,
        phone: q.phone,
        addressLine: `${tbc} (from quote ${q.number})`,
        city: tbc,
        state: "",
        postalCode: "",
        country: tbc,
        paymentMethod: "PURCHASE_ORDER",
        subtotal: 0,
        total: 0,
        notes: `Converted from quote ${q.number}${q.company ? ` · ${q.company}` : ""}\n\n${q.message}`,
        items: {
          create: [{ name: `Custom quote — ${q.category?.name ?? "General"} (qty ${qty})`, unitPrice: 0, quantity: qty, lineTotal: 0 }],
        },
      },
      select: { id: true },
    });
    await tx.quote.update({ where: { id: q.id }, data: { orderId: order.id, status: "WON" } });
    return order.id;
  });
  if (!orderId) return;
  revalidatePath("/admin/quotes");
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}`);
}

// ---------- coupons ----------

export async function createCoupon(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const code = text(form, "code", 30).toUpperCase();
  const percent = Number(text(form, "percent", 5));
  const fields: Record<string, string> = {};
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) fields.code = "3–20 letters, digits, - or _.";
  if (!Number.isInteger(percent) || percent < 1 || percent > 90) fields.percent = "Whole number from 1 to 90.";
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields };
  if (await db.coupon.findUnique({ where: { code }, select: { id: true } })) return { error: `${code} already exists.`, fields: { code: "Already exists." } };
  await db.coupon.create({ data: { code, percentOff: percent } });
  revalidatePath("/admin/coupons");
  return { ok: `${code} added (${percent}% off).` };
}

export async function toggleCoupon(id: string) {
  await assertAdmin();
  const c = await db.coupon.findUnique({ where: { id }, select: { active: true } });
  if (!c) return;
  await db.coupon.update({ where: { id }, data: { active: !c.active } });
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(id: string) {
  await assertAdmin();
  await db.coupon.deleteMany({ where: { id } }); // orders keep the code as text
  revalidatePath("/admin/coupons");
}

// ---------- email jobs ----------

export async function runEmailJobsNow(): Promise<AdminFormState> {
  await assertAdmin();
  const r = await runEmailJobs();
  revalidatePath("/admin");
  if ("skipped" in r) return { error: "The email jobs are already running; try again in a moment." };
  return {
    ok: `Order emails: ${r.orderEmails.sent} of ${r.orderEmails.tried} sent. Cart reminders: ${r.cartReminders.sent} of ${r.cartReminders.due} sent.`,
  };
}
