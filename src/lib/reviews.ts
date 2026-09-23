// Review helpers (server-only).
import { db } from "@/lib/db";

/** Product.rating = average of its approved reviews (1 decimal), or null without any. */
export async function refreshProductRating(productId: string) {
  const agg = await db.review.aggregate({ where: { productId, approved: true }, _avg: { rating: true } });
  const avg = agg._avg.rating;
  await db.product.update({ where: { id: productId }, data: { rating: avg == null ? null : Math.round(avg * 10) / 10 } });
}

/** Whether this customer has a non-cancelled order containing the product (by account or by email). */
export async function hasBought(productId: string, customer: { id: string; email: string }) {
  const n = await db.orderItem.count({
    where: {
      productId,
      order: { status: { not: "CANCELLED" }, OR: [{ customerId: customer.id }, { email: { equals: customer.email, mode: "insensitive" } }] },
    },
  });
  return n > 0;
}

/** "Jordan Kim" → "Jordan K." (what other shoppers see). */
export const publicName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};
