"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { toggleWishlist } from "@/app/actions/account";

type WishlistContext = {
  signedIn: boolean;
  ids: Set<string>;
  toggle: (productId: string) => void;
};

const Ctx = createContext<WishlistContext | null>(null);

// Wishlist ids for the hearts and the header badge. The server list (from the layout) seeds it; clicks update
// it at once and are saved by a server action. Signed-out clicks go to the login page.
export function WishlistProvider({
  signedIn,
  initialIds,
  children,
}: {
  signedIn: boolean;
  initialIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState(() => new Set(initialIds));

  // Take the server's list again whenever it changes (login, logout, a server refresh).
  const serverKey = `${signedIn}|${initialIds.join(",")}`;
  const [syncedKey, setSyncedKey] = useState(serverKey);
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setIds(new Set(initialIds));
  }

  const set = (productId: string, saved: boolean) =>
    setIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(productId);
      else next.delete(productId);
      return next;
    });

  const toggle = (productId: string) => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const wasSaved = ids.has(productId);
    set(productId, !wasSaved);
    toggleWishlist(productId).then(
      (res) => {
        if ("saved" in res) set(productId, res.saved);
        else if (res.error === "login") router.push(`/login?next=${encodeURIComponent(pathname)}`);
        else set(productId, wasSaved);
      },
      () => set(productId, wasSaved),
    );
  };

  return <Ctx.Provider value={{ signedIn, ids, toggle }}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWishlist needs <WishlistProvider>");
  return ctx;
}
