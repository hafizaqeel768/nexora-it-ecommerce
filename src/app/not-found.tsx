import Link from "next/link";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// 404 for every unknown URL (and notFound() calls), with the store header so people can find their way.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[70vh] pt-14 pb-[70px]">
        <div className="wrap">
          <div className="mx-auto max-w-[520px] py-10 text-center">
            <p className="text-[64px] leading-none font-black tracking-[-2px] text-accent">404</p>
            <h1 className="mt-3 text-[clamp(24px,4vw,32px)] font-bold">We couldn&apos;t find that page</h1>
            <p className="section-sub mx-auto mt-2 mb-6">The product may have been removed, or the link is mistyped. Try searching above, or:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/shop" className="btn">
                Browse the shop
              </Link>
              <Link href="/" className="btn border border-line bg-transparent text-ink hover:border-accent">
                Home page
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
