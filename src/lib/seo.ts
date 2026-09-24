// Search engine helpers (Phase 17, server-only): meta descriptions, "don't index" rules and structured data.
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

/** Plain text for a meta description: tags and extra spaces removed, cut at a word near `max` characters. */
export function metaText(text: string | null | undefined, max = 160) {
  const plain = (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Pages that must never appear in search results (accounts, cart, checkout…). Links on them are still followed. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: true };

/** Paths kept out of search engines in robots.txt (their pages also say noindex, or need a login). */
export const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/cart",
  "/checkout",
  "/order/",
  "/print/",
  "/wishlist",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/no-access",
  "/api/",
];

/** <script type="application/ld+json"> content; "<" is escaped so text from the database can't close the tag. */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

export const imageUrls = (images: string[]) => images.map((i) => absoluteUrl(i));
