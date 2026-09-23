// Order emails (server-only): queue a row in the same transaction as the order change, deliver it right
// after the response (next/server `after`), and let the jobs retry anything that failed.
import type { OrderEmailKind, OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { orderConfirmationEmail, orderStatusEmail } from "@/lib/email-templates";

export const MAX_EMAIL_ATTEMPTS = 5;

type Tx = Prisma.TransactionClient;

export async function queueOrderEmail(tx: Tx, orderId: string, kind: OrderEmailKind, orderStatus: OrderStatus, to: string) {
  return tx.orderEmail.create({ data: { orderId, kind, orderStatus, to }, select: { id: true } });
}

/** Sends one queued email. Claims the row first (attempts + 1) so two workers never send it twice. */
export async function deliverOrderEmail(id: string): Promise<boolean> {
  const row = await db.orderEmail.findUnique({
    where: { id },
    include: { order: { include: { items: { orderBy: { id: "asc" }, select: { name: true, quantity: true, lineTotal: true } } } } },
  });
  if (!row || row.sentAt || row.attempts >= MAX_EMAIL_ATTEMPTS) return false;
  const claim = await db.orderEmail.updateMany({ where: { id, sentAt: null, attempts: row.attempts }, data: { attempts: { increment: 1 } } });
  if (claim.count !== 1) return false;

  const mail = row.kind === "CONFIRMATION" ? orderConfirmationEmail(row.order, row.to) : orderStatusEmail(row.order, row.orderStatus, row.to);
  const result = await sendMail(mail);
  await db.orderEmail.update({
    where: { id },
    data: result.ok ? { sentAt: new Date(), error: null } : { error: result.error.slice(0, 500) },
  });
  if (!result.ok) console.error(`[email] order ${row.order.number} (${row.kind}) failed: ${result.error}`);
  return result.ok;
}

/** Retries queued/failed order emails (oldest first). Used by the email jobs. */
export async function deliverPendingOrderEmails(limit = 50) {
  const rows = await db.orderEmail.findMany({
    where: { sentAt: null, attempts: { lt: MAX_EMAIL_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const r of rows) if (await deliverOrderEmail(r.id)) sent++;
  return { tried: rows.length, sent };
}
