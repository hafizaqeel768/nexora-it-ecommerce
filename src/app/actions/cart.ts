"use server";

// Cart sync for signed-in customers (src/components/cart/cart-sync.tsx). Guests' carts stay in the browser only.
import type { CartLine } from "@/lib/cart-types";
import { db } from "@/lib/db";
import { cartLinesFor, cleanLines, saveCartFor } from "@/lib/saved-carts";
import { getViewer } from "@/lib/viewer";

export async function saveCart(lines: unknown): Promise<void> {
  const viewer = await getViewer();
  if (viewer) await saveCartFor(viewer.id, cleanLines(lines));
}

/** The saved cart with current prices, to restore it on a device whose cart is empty. */
export async function loadSavedCart(): Promise<CartLine[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const saved = await db.savedCart.findUnique({ where: { customerId: viewer.id }, select: { lines: true } });
  return saved ? cartLinesFor(cleanLines(saved.lines)) : [];
}
