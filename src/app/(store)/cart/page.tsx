import type { Metadata } from "next";
import { CartView } from "@/components/checkout/cart-view";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        <CartView />
      </div>
    </main>
  );
}
