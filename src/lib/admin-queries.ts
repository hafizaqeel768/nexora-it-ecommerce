// Admin list filters (server-only), shared by the admin pages and their CSV exports.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/** Shared by the list and the CSV export, so the export matches what's on screen. */
export async function productListWhere(q: string, cat: string, status: string): Promise<Prisma.ProductWhereInput> {
  const words = q.split(/\s+/).filter(Boolean);
  const top = cat ? await db.category.findUnique({ where: { slug: cat }, select: { id: true, children: { select: { id: true } } } }) : null;
  return {
    AND: words.map((w) => ({
      OR: [
        { name: { contains: w, mode: "insensitive" as const } },
        { brand: { contains: w, mode: "insensitive" as const } },
        { sku: { contains: w, mode: "insensitive" as const } },
      ],
    })),
    ...(top ? { categoryId: { in: [top.id, ...top.children.map((c) => c.id)] } } : {}),
    ...(status === "ACTIVE" || status === "DRAFT" ? { status } : {}),
  };
}

/** Category tree for the product form's select. */
export function categoryGroups() {
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, children: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } },
  });
}

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  registered: boolean;
  taxExempt: boolean;
  orders: number;
  spent: number;
  lastOrder: Date | null;
};

/**
 * Customers with order stats (the prototype's a_cust). Stats are grouped by order email, so guest
 * orders placed with a registered email count for that customer too. Sorted by total spent.
 */
export async function customerRows(): Promise<CustomerRow[]> {
  const [customers, byEmail, spentByEmail] = await Promise.all([
    db.customer.findMany({ select: { id: true, name: true, email: true, role: true, passwordHash: true, taxExempt: true } }),
    db.order.groupBy({ by: ["email"], _count: { _all: true }, _max: { createdAt: true } }),
    db.order.groupBy({ by: ["email"], where: { status: { not: "CANCELLED" } }, _sum: { total: true } }),
  ]);
  const stats = new Map<string, { orders: number; spent: number; lastOrder: Date | null }>();
  for (const g of byEmail) {
    const key = g.email.toLowerCase();
    const s = stats.get(key) ?? { orders: 0, spent: 0, lastOrder: null };
    s.orders += g._count._all;
    if (g._max.createdAt && (!s.lastOrder || g._max.createdAt > s.lastOrder)) s.lastOrder = g._max.createdAt;
    stats.set(key, s);
  }
  for (const g of spentByEmail) {
    const s = stats.get(g.email.toLowerCase());
    if (s) s.spent += Number(g._sum.total ?? 0);
  }
  return customers
    .map((c) => {
      const s = stats.get(c.email.toLowerCase()) ?? { orders: 0, spent: 0, lastOrder: null };
      return { id: c.id, name: c.name, email: c.email, role: c.role, registered: !!c.passwordHash, taxExempt: c.taxExempt, ...s, spent: Math.round(s.spent * 100) / 100 };
    })
    .sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name));
}
