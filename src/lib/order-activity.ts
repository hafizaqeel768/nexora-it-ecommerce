// Staff-only order timeline (server-only): automatic events next to internal notes (OrderNote).
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

/** Records an automatic event, e.g. "Status: Pending → Shipped". */
export function logOrderEvent(client: Client, orderId: string, body: string, authorName?: string | null) {
  return client.orderNote.create({ data: { orderId, kind: "EVENT", body: body.slice(0, 2000), authorName: authorName ?? null } });
}
