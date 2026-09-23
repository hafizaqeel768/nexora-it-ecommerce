// The signed-in customer for this request (server-only), read once and shared by the layout and pages.
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;

/** null when signed out, or when the session points at a customer that no longer has an account. */
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
      addressLine: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      wishlistItems: { select: { productId: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer?.passwordHash || !customer.registeredAt) return null;
  const { passwordHash, wishlistItems, ...rest } = customer;
  void passwordHash; // never handed to pages
  return { ...rest, registeredAt: customer.registeredAt, wishlistIds: wishlistItems.map((w) => w.productId) };
});

/** Orders shown in the account: linked to this customer and placed since registering. */
export const accountOrdersWhere = (v: Pick<Viewer, "id" | "registeredAt">) => ({
  customerId: v.id,
  createdAt: { gte: v.registeredAt },
});
