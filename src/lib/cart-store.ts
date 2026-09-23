"use client";

// Cart state (Zustand), kept in localStorage like the prototype's nx_cart.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { lineKey, type CartLine, type CartProduct } from "@/lib/cart-types";
import { cartTotals, lineUnitPrice } from "@/lib/pricing";
import type { StoreRules } from "@/lib/store-settings";

type CartState = {
  lines: CartLine[];
  promo: { code: string; percent: number } | null;
  drawerOpen: boolean;
  add: (product: CartProduct, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Replaces the lines (restoring a saved cart) without opening the drawer. */
  restore: (lines: CartLine[]) => void;
  setPromo: (promo: CartState["promo"]) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      promo: null,
      drawerOpen: false,
      add: (product, quantity) =>
        set((s) => {
          const key = lineKey(product.productId, product.variantId);
          const existing = s.lines.find((l) => l.key === key);
          const lines = existing
            ? s.lines.map((l) => (l.key === key ? { ...l, ...product, quantity: Math.min(l.maxQty, l.quantity + quantity) } : l))
            : [...s.lines, { ...product, key, quantity: Math.min(product.maxQty, quantity) }];
          return { lines, drawerOpen: true };
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          lines: s.lines
            .map((l) => (l.key === key ? { ...l, quantity: Math.min(l.maxQty, quantity) } : l))
            .filter((l) => l.quantity > 0),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [], promo: null }),
      restore: (lines) => set({ lines }),
      setPromo: (promo) => set({ promo }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "nexora-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines, promo: s.promo }),
      // Rehydrated after mount (CartDrawer), so server and first client render agree.
      skipHydration: true,
    },
  ),
);

export const unitPriceOf = (l: CartLine) => lineUnitPrice(l.price, l.tiers, l.quantity, l.variantDelta);

export const itemCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

export const totalsOf = (lines: CartLine[], promoPercent: number, rules: StoreRules) =>
  cartTotals(
    lines.map((l) => ({ unitPrice: unitPriceOf(l), quantity: l.quantity })),
    promoPercent,
    rules,
  );
