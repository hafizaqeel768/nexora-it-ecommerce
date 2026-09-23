"use client";

import { useEffect, useRef, useState } from "react";
import { loadSavedCart, saveCart } from "@/app/actions/cart";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { useCart } from "@/lib/cart-store";

// Signed-in customers: keeps a server copy of the cart (for reminders and other devices), and restores it
// when this browser's cart is empty. Guests: does nothing.
export function CartSync() {
  const { signedIn } = useWishlist();
  const lines = useCart((s) => s.lines);
  const [ready, setReady] = useState(false);
  const restoredFor = useRef(false);

  // After the saved browser cart has loaded: restore from the server once per sign-in if it's empty.
  useEffect(() => {
    if (!signedIn) {
      restoredFor.current = false;
      setReady(false);
      return;
    }
    let cancelled = false;
    const start = async () => {
      if (!restoredFor.current && useCart.getState().lines.length === 0) {
        restoredFor.current = true;
        const saved = await loadSavedCart().catch(() => []);
        if (!cancelled && saved.length && useCart.getState().lines.length === 0) useCart.getState().restore(saved);
      }
      restoredFor.current = true;
      if (!cancelled) setReady(true);
    };
    const unsub = useCart.persist.onFinishHydration(() => void start());
    if (useCart.persist.hasHydrated()) void start();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [signedIn]);

  // Then save changes, a moment after the last one.
  useEffect(() => {
    if (!signedIn || !ready) return;
    const t = setTimeout(() => {
      void saveCart(lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }))).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [signedIn, ready, lines]);

  return null;
}
