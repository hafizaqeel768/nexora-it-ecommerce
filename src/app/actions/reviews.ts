"use server";

// Reviews (Phase 12): customers write them on the product page; admins moderate in Admin → Reviews.
import { revalidatePath } from "next/cache";
import type { AdminFormState } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/account";
import { assertAdmin } from "@/lib/admin";
import { getConfig, saveConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { hasBought, publicName, refreshProductRating } from "@/lib/reviews";
import { getViewer } from "@/lib/viewer";

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);

async function refreshProduct(productId: string) {
  await refreshProductRating(productId);
  const p = await db.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (p) revalidatePath(`/product/${p.slug}`);
  revalidatePath("/admin/reviews");
}

/** Creates or updates the signed-in customer's review of a product (one per product). */
export async function submitReview(productId: string, _: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please log in to write a review." };
  const settings = await getConfig("reviews");
  if (!settings.enabled) return { error: "Reviews are switched off." };
  const product = await db.product.findFirst({ where: { id: productId, status: "ACTIVE" }, select: { id: true } });
  if (!product) return { error: "This product is no longer available." };

  const rating = Number(text(form, "rating", 1));
  const title = text(form, "title", 100);
  const body = text(form, "body", 2000);
  const fields: Record<string, string> = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fields.rating = "Please choose 1 to 5 stars.";
  if (body.length < 10) fields.body = "Please write at least a sentence (10 characters).";
  if (Object.keys(fields).length) return { error: "Please check the highlighted fields.", fields, values: { title, body } };

  const verifiedBuyer = await hasBought(productId, viewer);
  if (settings.buyersOnly && !verifiedBuyer) return { error: "Only customers who bought this product can review it." };

  const data = { rating, title: title || null, body, authorName: publicName(viewer.name), verifiedBuyer, approved: !settings.requireApproval };
  await db.review.upsert({
    where: { productId_customerId: { productId, customerId: viewer.id } },
    create: { ...data, productId, customerId: viewer.id },
    update: { ...data, createdAt: new Date() },
  });
  await refreshProduct(productId);
  return { ok: settings.requireApproval ? "Thank you! Your review will appear once it's approved." : "Thank you! Your review is live." };
}

// ---------- admin ----------

export async function setReviewApproved(reviewId: string, approved: boolean) {
  await assertAdmin("reviews.moderate");
  const r = await db.review.update({ where: { id: reviewId }, data: { approved }, select: { productId: true } });
  await refreshProduct(r.productId);
}

export async function deleteReview(reviewId: string) {
  await assertAdmin("reviews.moderate");
  const r = await db.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
  if (!r) return;
  await db.review.delete({ where: { id: reviewId } });
  await refreshProduct(r.productId);
}

export async function saveReviewSettings(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await assertAdmin("reviews.moderate");
  const on = (k: string) => form.get(k) === "on";
  await saveConfig("reviews", { enabled: on("enabled"), requireApproval: on("requireApproval"), buyersOnly: on("buyersOnly") });
  revalidatePath("/", "layout");
  revalidatePath("/admin/reviews");
  return { ok: "Review settings saved." };
}
