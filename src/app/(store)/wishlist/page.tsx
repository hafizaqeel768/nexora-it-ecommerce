import type { Metadata } from "next";
import Link from "next/link";
import { SignInPrompt } from "@/components/account/sign-in-prompt";
import { ProductCard } from "@/components/product/product-card";
import { db } from "@/lib/db";
import { cardInclude, toCard } from "@/lib/products";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Wishlist | Nexora IT" };

// My wishlist (the prototype's wishlistHTML), newest first. Products that went inactive are skipped.
export default async function WishlistPage() {
  const viewer = await getViewer();
  const items = viewer
    ? await db.wishlistItem.findMany({
        where: { customerId: viewer.id, product: { status: "ACTIVE" } },
        orderBy: { createdAt: "desc" },
        include: { product: { include: cardInclude } },
      })
    : [];

  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        {!viewer ? (
          <SignInPrompt text="Sign in to save products for later." next="/wishlist" />
        ) : (
          <>
            <h1 className="text-[clamp(26px,4vw,36px)] leading-[1.15] font-bold tracking-[-.8px]">My wishlist</h1>
            <p className="section-sub mt-2 mb-[26px]">Items you have saved for later.</p>
            {items.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[18px]">
                {items.map((w, i) => (
                  <ProductCard key={w.id} product={toCard(w.product)} index={i} />
                ))}
              </div>
            ) : (
              <p className="section-sub">
                Your wishlist is empty.{" "}
                <Link href="/shop" className="font-semibold text-accent">
                  Browse products →
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
