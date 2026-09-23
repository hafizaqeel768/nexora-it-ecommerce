"use client";

import { CartIcon } from "@/components/icons";
import { useStoreRules } from "@/components/store-rules-provider";
import { itemCount, totalsOf, useCart } from "@/lib/cart-store";

// Header cart button: badge + "N items - USD x", opens the mini cart (the prototype's .cbox).
export function CartButton() {
  const lines = useCart((s) => s.lines);
  const openDrawer = useCart((s) => s.openDrawer);
  const count = itemCount(lines);
  const subtotal = totalsOf(lines, 0, useStoreRules()).subtotal;

  return (
    <button
      type="button"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      onClick={openDrawer}
      className="group/cart flex flex-none cursor-pointer items-center gap-3 rounded-10 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent max-md:order-2"
    >
      <span className="relative grid size-[42px] place-items-center rounded-10 bg-black text-white transition-colors group-hover/cart:bg-accent">
        <CartIcon className="size-[21px]" />
        {count > 0 && (
          <span className="absolute -top-[5px] -right-[5px] grid h-5 min-w-5 place-items-center rounded-pill border-2 border-white bg-accent px-[5px] text-11 font-bold text-white">
            {count}
          </span>
        )}
      </span>
      <span className="max-md:hidden">
        <b className="block text-14 font-semibold text-header-ink">SHOPPING CART</b>
        <small className="text-caption text-header-text">
          {count} item{count === 1 ? "" : "s"} - USD {subtotal.toFixed(2)}
        </small>
      </span>
    </button>
  );
}
