import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartSync } from "@/components/cart/cart-sync";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Storefront chrome for every shop page (URLs are unchanged: (store) is a route group).
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <CartDrawer />
      <CartSync />
    </>
  );
}
