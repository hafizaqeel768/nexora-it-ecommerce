"use client";

import { useCart } from "@/lib/cart-store";
import type { CartProduct } from "@/lib/cart-types";

type Props = { product: CartProduct; quantity?: number; className: string; children?: React.ReactNode };

// Adds to the cart and opens the mini cart, like the prototype's addCart().
export function AddToCartButton({ product, quantity = 1, className, children = "Add to cart" }: Props) {
  const add = useCart((s) => s.add);
  return (
    <button type="button" className={className} disabled={!product.available} onClick={() => add(product, quantity)}>
      {product.available ? children : "Out of stock"}
    </button>
  );
}
