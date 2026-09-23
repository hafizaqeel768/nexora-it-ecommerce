"use client";

import Link from "next/link";
import { HeartIcon } from "@/components/icons";
import { useWishlist } from "@/components/wishlist/wishlist-provider";

// Heart on product cards (the prototype's .wbtn).
export function WishlistHeart({ productId }: { productId: string }) {
  const { ids, toggle } = useWishlist();
  const saved = ids.has(productId);
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      onClick={() => toggle(productId)}
      className={`absolute top-2.5 right-2.5 z-[2] grid size-8 cursor-pointer place-items-center rounded-full bg-white text-15 shadow-[0_4px_12px_#0002] transition hover:scale-110 ${
        saved ? "text-accent" : "text-[#c9ccd3]"
      }`}
    >
      ♥
    </button>
  );
}

// "Save for later" on the product page (the prototype's #wishbtn).
export function SaveForLaterButton({ productId, className }: { productId: string; className: string }) {
  const { ids, toggle } = useWishlist();
  const saved = ids.has(productId);
  return (
    <button type="button" aria-pressed={saved} onClick={() => toggle(productId)} className={className}>
      {saved ? "♥ Saved" : "♡ Save for later"}
    </button>
  );
}

// Header wishlist button with its count badge (the prototype's .wbox).
export function WishlistHeaderLink({ className, badgeClassName }: { className: string; badgeClassName: string }) {
  const { ids } = useWishlist();
  return (
    <Link href="/wishlist" aria-label={`Wishlist, ${ids.size} item${ids.size === 1 ? "" : "s"}`} className={className}>
      <HeartIcon className="size-5" />
      {ids.size > 0 && <span className={badgeClassName}>{ids.size}</span>}
    </Link>
  );
}
