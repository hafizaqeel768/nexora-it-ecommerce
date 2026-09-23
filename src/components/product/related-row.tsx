"use client";

import { useRef } from "react";

// Horizontal "Related products" row with ‹ › buttons (the prototype's .hh/.hrow). Cards are server-rendered children.
export function RelatedRow({ children }: { children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * 480, behavior: "smooth" });
  const btn =
    "size-[42px] cursor-pointer rounded-full border border-line bg-white text-22 leading-none text-ink transition hover:border-accent hover:bg-accent hover:text-white";

  return (
    <section aria-labelledby="related-title">
      <div className="mt-14 mb-4 flex items-center justify-between">
        <h2 id="related-title" className="text-[clamp(22px,3vw,28px)] font-bold tracking-[-.5px]">
          Related products
        </h2>
        <span className="flex gap-2">
          <button type="button" aria-label="Scroll related products left" className={btn} onClick={() => scroll(-1)}>
            ‹
          </button>
          <button type="button" aria-label="Scroll related products right" className={btn} onClick={() => scroll(1)}>
            ›
          </button>
        </span>
      </div>
      <div
        ref={row}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-0.5 pt-1.5 pb-4 [scrollbar-width:thin] [&>*]:flex-[0_0_232px] [&>*]:snap-start"
      >
        {children}
      </div>
    </section>
  );
}
