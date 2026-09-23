"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CartLine } from "@/components/cart/cart-line";
import { itemCount, totalsOf, useCart } from "@/lib/cart-store";
import { money } from "@/lib/format";

// Mini cart (the prototype's #mini + #ov) and the "resume checkout" nudge. Also loads the saved cart.
export function CartDrawer() {
  const { lines, drawerOpen, closeDrawer } = useCart();
  const pathname = usePathname();
  const [nudge, setNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const count = itemCount(lines);
  const subtotal = totalsOf(lines, 0).subtotal;
  const onCartPages = pathname === "/cart" || pathname.startsWith("/checkout") || pathname.startsWith("/order");

  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);

  // Close the drawer on navigation.
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  // Show the nudge a moment after landing on a page with items in the cart (the prototype's cartNudgeCheck).
  useEffect(() => {
    setNudge(false);
    if (!count || onCartPages || nudgeDismissed || drawerOpen) return;
    const t = setTimeout(() => setNudge(true), 2600);
    return () => clearTimeout(t);
  }, [count, onCartPages, nudgeDismissed, drawerOpen, pathname]);

  const btn = "btn cursor-pointer border-0 text-center text-15";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={`fixed inset-0 z-[55] bg-[#000a] transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        aria-label="Mini cart"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        className={`fixed top-0 right-0 z-[60] flex h-full w-[min(400px,100%)] flex-col bg-white text-[#0d0d0d] shadow-[-10px_0_40px_#0008] transition-transform duration-350 ease-in-out ${
          drawerOpen ? "" : "translate-x-[105%]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e2e5e9] px-5 py-[18px]">
          <h3 className="text-18 font-bold">Your cart ({count})</h3>
          <button type="button" aria-label="Close cart" className="cursor-pointer px-2 py-1 text-18" onClick={closeDrawer}>
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto px-[18px] py-1 [--line:#e2e5e9] [--muted:#5f6368]">
          {lines.length ? lines.map((l) => <CartLine key={l.key} line={l} />) : <p className="section-sub py-6">Your cart is empty.</p>}
        </div>
        <div className="grid gap-2.5 border-t border-[#e2e5e9] px-5 py-4">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <b>{money(subtotal)}</b>
          </div>
          <Link href="/cart" className={`${btn} border border-[#e2e5e9] !bg-transparent !text-ink`}>
            View cart
          </Link>
          <Link href="/checkout" className={btn}>
            Checkout
          </Link>
        </div>
      </aside>

      <div
        role="status"
        className={`fixed bottom-6 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3.5 rounded-pill border border-[#2a2a2a] bg-[#111] py-3.5 pr-4 pl-5 text-14 text-white shadow-[0_20px_50px_#0006] transition-transform duration-350 ease-in-out ${
          nudge ? "" : "translate-y-[140%]"
        }`}
      >
        {nudge && (
          <>
            <span>
              🛒 You have {count} item{count === 1 ? "" : "s"} waiting — {money(subtotal)}
            </span>
            <Link href="/checkout" className="btn px-4 py-[9px] text-13 whitespace-nowrap">
              Resume checkout
            </Link>
            <button type="button" aria-label="Dismiss" className="cursor-pointer p-1 text-[#9a9a9a]" onClick={() => setNudgeDismissed(true)}>
              ✕
            </button>
          </>
        )}
      </div>
    </>
  );
}
