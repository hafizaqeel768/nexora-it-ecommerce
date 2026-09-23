// One-time tokens for email links (server-only). The raw token only exists in the email; the database
// keeps a SHA-256 hash, so a database leak doesn't hand out working links.
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenPurpose } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const TTL_MS: Record<AuthTokenPurpose, number> = { VERIFY_EMAIL: 24 * 60 * 60 * 1000, RESET_PASSWORD: 60 * 60 * 1000 };
/** At most one new link per account and purpose per minute (stops email flooding). */
const MIN_GAP_MS = 60 * 1000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new raw token, or null when one was issued less than a minute ago. */
export async function issueToken(customerId: string, purpose: AuthTokenPurpose): Promise<string | null> {
  const recent = await db.authToken.findFirst({
    where: { customerId, purpose, createdAt: { gt: new Date(Date.now() - MIN_GAP_MS) } },
    select: { id: true },
  });
  if (recent) return null;
  const token = randomBytes(32).toString("base64url");
  await db.authToken.create({ data: { tokenHash: hash(token), purpose, customerId, expiresAt: new Date(Date.now() + TTL_MS[purpose]) } });
  return token;
}

/** The customer a still-valid token belongs to, without using it up (to show the reset form). */
export async function peekToken(token: string, purpose: AuthTokenPurpose) {
  if (!token || token.length > 100) return null;
  const row = await db.authToken.findUnique({ where: { tokenHash: hash(token) }, select: { purpose: true, usedAt: true, expiresAt: true, customerId: true } });
  return row && row.purpose === purpose && !row.usedAt && row.expiresAt > new Date() ? row.customerId : null;
}

/** Uses the token up (exactly once, even with two clicks at the same moment) and returns its customer. */
export async function consumeToken(token: string, purpose: AuthTokenPurpose): Promise<string | null> {
  const customerId = await peekToken(token, purpose);
  if (!customerId) return null;
  const res = await db.authToken.updateMany({
    where: { tokenHash: hash(token), purpose, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return res.count === 1 ? customerId : null;
}
