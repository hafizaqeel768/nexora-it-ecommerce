"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CategoryGlyph, MenuIcon } from "@/components/icons";
import { categories, categoryHref } from "@/lib/site-nav";

// "ALL CATEGORIES" dropdown. Opens on hover (pointer devices, via CSS) and on click/tap (state).
export function CategoryMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="group/cat relative flex-none">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="category-menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 min-w-[210px] cursor-pointer items-center gap-3.5 rounded-6 bg-white px-5 text-nav font-bold tracking-[.3px] text-header-ink transition hover:shadow-[0_0_0_3px_#ffffff55] max-md:gap-2"
      >
        <MenuIcon className="size-5 stroke-header-ink" />
        ALL CATEGORIES
      </button>
      <div
        id="category-menu"
        className={`absolute top-[calc(100%+8px)] left-0 min-w-[300px] rounded-14 bg-white p-2 shadow-menu transition duration-200 group-hover/cat:visible group-hover/cat:translate-y-0 group-hover/cat:opacity-100 ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0"
        }`}
      >
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={categoryHref(c.slug)}
            onClick={close}
            className="flex items-center gap-3 rounded-10 px-3.5 py-3 text-nav font-semibold text-header-ink transition duration-150 hover:bg-accent-soft hover:text-accent"
          >
            <CategoryGlyph name={c.slug} className="size-[22px] stroke-accent" />
            {c.name}
          </Link>
        ))}
        <Link
          href="/shop"
          onClick={close}
          className="flex items-center gap-3 rounded-10 px-3.5 py-3 text-nav font-semibold text-accent transition duration-150 hover:bg-accent-soft"
        >
          <ArrowRightIcon strokeWidth={1.7} className="size-[22px] stroke-accent" />
          View all products
        </Link>
      </div>
    </div>
  );
}
