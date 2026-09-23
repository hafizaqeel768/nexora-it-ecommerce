"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-store";

/** Empties the cart once an order is confirmed. */
export function ClearCart() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    // Wait for the saved cart to load first, otherwise rehydration would restore it.
    const unsub = useCart.persist.onFinishHydration(() => clear());
    if (useCart.persist.hasHydrated()) clear();
    return unsub;
  }, [clear]);
  return null;
}
