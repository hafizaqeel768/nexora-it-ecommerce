"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CategoryGlyph, GridIcon } from "@/components/icons";
import { isCategoryIcon } from "@/lib/site-nav";

type Props = { images: string[]; name: string; topCategoryIcon: string | null };

// Product gallery (the prototype's gal/initGal): main image with hover zoom, arrows, dots,
// thumbnails, swipe, and a lightbox on click. Arrows/dots/thumbnails only appear with 2+ images.
export function Gallery({ images, name, topCategoryIcon }: Props) {
  const [k, setK] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;
  const show = (n: number) => setK((n + images.length) % images.length);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setK((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setK((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, images.length]);

  if (!images.length) {
    // No photo yet: neutral category icon, never a stock image.
    return (
      <div className="grid aspect-[4/3.1] place-items-center rounded-18 border border-line bg-white text-accent/60">
        {isCategoryIcon(topCategoryIcon) ? <CategoryGlyph name={topCategoryIcon} className="size-28" /> : <GridIcon className="size-28" />}
      </div>
    );
  }

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const arrow =
    "absolute bottom-2.5 z-[2] grid size-[34px] cursor-pointer place-items-center rounded-full bg-white text-20 leading-none text-[#111] shadow-[0_4px_16px_#0003] transition hover:bg-accent hover:text-white";

  return (
    <div className="grid gap-3.5">
      <div
        className="relative aspect-[4/3.1] cursor-zoom-in overflow-hidden rounded-18 border border-line bg-white"
        onMouseMove={onMove}
        onMouseLeave={() => setZoom(null)}
        onClick={() => setLightbox(true)}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null || !many) return;
          const d = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(d) > 40) show(d < 0 ? k + 1 : k - 1);
          touchX.current = null;
        }}
      >
        <Image
          key={images[k]}
          src={images[k]}
          alt={name}
          fill
          priority
          sizes="(max-width: 800px) 100vw, 530px"
          className="animate-gfade object-contain transition-transform duration-250 ease-out select-none"
          style={zoom ? { transformOrigin: zoom, transform: "scale(1.9)" } : undefined}
        />
        <span className="pointer-events-none absolute top-3 right-3 z-[2] rounded-pill bg-[#000a] px-2.5 py-1 text-11 text-white opacity-85 max-lg:hidden">
          Hover to zoom · Click to enlarge
        </span>
        {many && (
          <>
            <button type="button" aria-label="Previous image" className={`${arrow} left-3`} onClick={(e) => (e.stopPropagation(), show(k - 1))}>
              ‹
            </button>
            <button type="button" aria-label="Next image" className={`${arrow} right-3`} onClick={(e) => (e.stopPropagation(), show(k + 1))}>
              ›
            </button>
            <div className="absolute inset-x-0 bottom-3 z-[2] flex justify-center gap-[7px]">
              {images.map((src, i) => (
                <i key={src} className={`h-2 rounded-[9px] transition-all duration-300 ${i === k ? "w-6 bg-accent" : "w-2 bg-[#0003]"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {many && (
        <div className="flex gap-2.5 overflow-x-auto px-0.5 pt-1 pb-2 [scrollbar-width:thin]">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`Image ${i + 1}`}
              onClick={() => show(i)}
              className={`relative h-[74px] w-24 flex-none cursor-pointer overflow-hidden rounded-12 border-2 bg-white transition hover:-translate-y-0.5 ${
                i === k ? "border-accent shadow-[0_4px_14px_#d21f2b33]" : "border-line hover:border-[#c9ced6]"
              }`}
            >
              <Image src={src} alt="" fill sizes="96px" className="object-contain" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={name}
          className="fixed inset-0 z-[90] grid place-items-center bg-[#000e] p-5"
          onClick={(e) => e.target === e.currentTarget && setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- natural size in the lightbox */}
          <img
            src={images[k]}
            alt={name}
            className="max-h-[82vh] w-auto max-w-[min(92vw,1000px)] animate-rise rounded-14 bg-white object-contain"
          />
          {[
            { label: "Close", cls: "top-[18px] right-[18px] text-20", act: () => setLightbox(false), text: "✕", show: true },
            { label: "Previous image", cls: "top-1/2 left-[18px] -mt-[23px]", act: () => show(k - 1), text: "‹", show: many },
            { label: "Next image", cls: "top-1/2 right-[18px] -mt-[23px]", act: () => show(k + 1), text: "›", show: many },
          ]
            .filter((b) => b.show)
            .map((b) => (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                onClick={b.act}
                className={`absolute grid size-[46px] cursor-pointer place-items-center rounded-full bg-[#ffffff1f] text-26 text-white transition hover:bg-accent ${b.cls}`}
              >
                {b.text}
              </button>
            ))}
          <div className="absolute inset-x-0 bottom-5 text-center text-13 text-[#ccc]">
            {k + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
