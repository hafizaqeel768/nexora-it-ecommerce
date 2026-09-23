// The signed-in customer for this request (server-only), read once and shared by the layout and pages.
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

/**
 * null when signed out, when the session points at a customer that no longer has an account, or when the
 * session is older than the last password change (a reset signs out every other device).
 */
export const getViewer = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const customer = await db.customer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      passwordHash: true,
      registeredAt: true,
      emailVerifiedAt: true,
      passwordChangedAt: true,
      taxExempt: true,
      addressLine: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      wishlistItems: { select: { productId: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer?.passwordHash || !customer.registeredAt) return null;
  const changed = customer.passwordChangedAt ? Math.floor(customer.passwordChangedAt.getTime() / 1000) : 0;
  if (changed && (session.issuedAt ?? 0) < changed) return null;
  const { passwordHash, passwordChangedAt, wishlistItems, ...rest } = customer;
  void passwordHash; // never handed to pages
  void passwordChangedAt;
  return { ...rest, registeredAt: customer.registeredAt, wishlistIds: wishlistItems.map((w) => w.productId) };
});

/**
 * Orders shown in the account. Verified email: everything linked to the account or placed with that email
 * (including earlier guest checkouts). Not verified yet: only orders linked to the account since registering.
 */
export const accountOrdersWhere = (v: Pick<Viewer, "id" | "email" | "registeredAt" | "emailVerifiedAt">): Prisma.OrderWhereInput =>
  v.emailVerifiedAt
    ? { OR: [{ customerId: v.id }, { email: { equals: v.email, mode: "insensitive" } }] }
    : { customerId: v.id, createdAt: { gte: v.registeredAt } };
