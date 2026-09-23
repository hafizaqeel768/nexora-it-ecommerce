// Server copy of signed-in customers' carts (server-only): sync, restore on another device, reminders.
import { lineKey, type CartLine } from "@/lib/cart-types";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { abandonedCartEmail } from "@/lib/email-templates";
import { lineUnitPrice } from "@/lib/pricing";

export type SavedLine = { productId: string; variantId: string | null; quantity: number };

/** Hours a cart must sit untouched before the reminder (ABANDONED_CART_HOURS, default 3). */
const ABANDONED_AFTER_MS = Math.max(0.01, Number(process.env.ABANDONED_CART_HOURS ?? 3)) * 60 * 60 * 1000;

export function cleanLines(input: unknown): SavedLine[] {
  if (!Array.isArray(input)) return [];
  const id = (v: unknown) => (typeof v === "string" && /^[a-z0-9]{10,40}$/.test(v) ? v : null);
  return input
    .slice(0, 50)
    .map((l) => ({ productId: id(l?.productId), variantId: id(l?.variantId), quantity: Number(l?.quantity) }))
    .filter((l): l is SavedLine => !!l.productId && Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 10000);
}

/** Saves the cart; unchanged carts keep their reminder state, so restoring a cart doesn't trigger another reminder. */
export async function saveCartFor(customerId: string, lines: SavedLine[]) {
  if (!lines.length) {
    await db.savedCart.deleteMany({ where: { customerId } });
    return;
  }
  const current = await db.savedCart.findUnique({ where: { customerId }, select: { lines: true } });
  // Compare values, not JSON text: Postgres jsonb reorders object keys.
  const sig = (ls: SavedLine[]) => ls.map((l) => `${l.productId}:${l.variantId ?? ""}:${l.quantity}`).join("|");
  if (current && sig(cleanLines(current.lines)) === sig(lines)) return;
  await db.savedCart.upsert({ where: { customerId }, create: { customerId, lines }, update: { lines, changedAt: new Date(), remindedAt: null } });
}

/** Cart lines rebuilt from current catalog data (inactive products and removed options are dropped). */
export async function cartLinesFor(saved: SavedLine[]): Promise<CartLine[]> {
  const products = await db.product.findMany({
    where: { id: { in: saved.map((l) => l.productId) }, status: "ACTIVE" },
    include: { priceTiers: { orderBy: { minQty: "asc" } }, variants: true },
  });
  return saved.flatMap((l) => {
    const p = products.find((x) => x.id === l.productId);
    const v = l.variantId ? p?.variants.find((x) => x.id === l.variantId) : null;
    if (!p || (l.variantId && !v)) return [];
    const maxQty = p.stock ?? 999;
    return [
      {
        key: lineKey(p.id, v?.id ?? null),
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: p.image,
        price: Number(p.price),
        tiers: p.priceTiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, multiplier: Number(t.multiplier) })),
        variantId: v?.id ?? null,
        variantName: v ? `${v.attribute}: ${v.name}` : null,
        variantDelta: v ? Number(v.priceDelta) : 0,
        maxQty,
        available: p.availability !== "OUT_OF_STOCK" && p.stock !== 0,
        quantity: Math.min(l.quantity, maxQty),
      },
    ];
  });
}

/**
 * Emails one reminder per untouched cart, only to confirmed email addresses (so nobody can use a
 * made-up account to send mail to someone else), and skips people who ordered since.
 */
export async function sendAbandonedCartReminders(limit = 50) {
  const carts = await db.savedCart.findMany({
    where: { remindedAt: null, changedAt: { lt: new Date(Date.now() - ABANDONED_AFTER_MS) }, customer: { emailVerifiedAt: { not: null } } },
    include: { customer: { select: { id: true, name: true, email: true } } },
    orderBy: { changedAt: "asc" },
    take: limit,
  });
  let sent = 0;
  for (const cart of carts) {
    // Claim this version of the cart first, so parallel runs never send twice.
    const claim = await db.savedCart.updateMany({ where: { customerId: cart.customerId, remindedAt: null, changedAt: cart.changedAt }, data: { remindedAt: new Date() } });
    if (claim.count !== 1) continue;
    const ordered = await db.order.count({
      where: { createdAt: { gte: cart.changedAt }, OR: [{ customerId: cart.customerId }, { email: { equals: cart.customer.email, mode: "insensitive" } }] },
    });
    const lines = ordered ? [] : await cartLinesFor(cleanLines(cart.lines));
    if (!lines.length) continue;
    const items = lines.map((l) => ({
      name: l.variantName ? `${l.name} (${l.variantName})` : l.name,
      quantity: l.quantity,
      price: lineUnitPrice(l.price, l.tiers, l.quantity, l.variantDelta),
    }));
    const total = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
    const res = await sendMail(await abandonedCartEmail(cart.customer.name, cart.customer.email, items, total));
    if (res.ok) sent++;
    else {
      // Try again on the next run.
      await db.savedCart.updateMany({ where: { customerId: cart.customerId, changedAt: cart.changedAt }, data: { remindedAt: null } });
      console.error(`[email] cart reminder for ${cart.customer.email} failed: ${res.error}`);
    }
  }
  return { due: carts.length, sent };
}
