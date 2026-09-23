import Image from "next/image";
import Link from "next/link";
import { CategoryGlyph, GridIcon } from "@/components/icons";
import { money, stars } from "@/lib/format";
import type { ProductCardData } from "@/lib/products";
import { isCategoryIcon } from "@/lib/site-nav";

// Product card (the prototype's .pc). Add to cart (Phase 7) and wishlist (Phase 8) are not wired yet.
const badges = {
  sale: { label: "Sale", className: "bg-accent" },
  bulk: { label: "Bulk pricing", className: "bg-[#0f766e]" },
  options: { label: "Options", className: "bg-[#2563eb]" },
};

export function ProductCard({ product: p, index = 0 }: { product: ProductCardData; index?: number }) {
  const href = `/product/${p.slug}`;
  const badge = p.badge ? badges[p.badge] : null;

  return (
    <div
      className="group flex animate-rise flex-col gap-1.5 rounded-18 border border-line bg-surface p-3.5 shadow-[0_6px_22px_#0000000d] transition duration-250 hover:-translate-y-1.5 hover:border-accent hover:shadow-card-hover"
      style={{ animationDelay: `${(index % 8) * 0.05}s` }}
    >
      <div className="relative grid h-[170px] place-items-center overflow-hidden rounded-14 bg-[radial-gradient(circle_at_30%_20%,#d21f2b1f,transparent_60%),linear-gradient(145deg,#fff,#eef1f4)]">
        <Link href={href} className="absolute inset-0" aria-label={p.name}>
          {p.image ? (
            <>
              <Image
                src={p.image}
                alt={p.name}
                fill
                sizes="(max-width: 520px) 90vw, 260px"
                className={`object-contain mix-blend-multiply transition duration-400 group-hover:scale-110 ${p.hoverImage ? "group-hover:opacity-0" : ""}`}
              />
              {p.hoverImage && (
                <Image
                  src={p.hoverImage}
                  alt=""
                  fill
                  sizes="(max-width: 520px) 90vw, 260px"
                  className="object-contain opacity-0 mix-blend-multiply transition duration-400 group-hover:scale-110 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            // No photo yet: neutral category icon, never a stock image.
            <span className="grid h-full place-items-center text-accent/70 transition duration-400 group-hover:scale-110">
              {isCategoryIcon(p.topCategorySlug) ? (
                <CategoryGlyph name={p.topCategorySlug} className="size-16" />
              ) : (
                <GridIcon className="size-16" />
              )}
            </span>
          )}
        </Link>
        {badge && (
          <b className={`absolute top-2.5 left-2.5 rounded-pill px-2.5 py-[3px] text-11 font-normal text-white ${badge.className}`}>
            {badge.label}
          </b>
        )}
        <button
          type="button"
          aria-label="Save to wishlist"
          className="absolute top-2.5 right-2.5 z-[2] grid size-8 cursor-pointer place-items-center rounded-full bg-white text-15 text-[#c9ccd3] shadow-[0_4px_12px_#0002] transition hover:scale-110"
        >
          ♥
        </button>
      </div>

      <small className="text-12 text-muted">
        {p.brand} · {p.categoryName}
      </small>
      <h3 className="min-h-10 text-15 leading-[1.3] font-bold">
        <Link href={href}>{p.name}</Link>
      </h3>
      {p.rating != null && (
        <div className="text-13 text-star">
          {stars(p.rating)} <i className="text-muted not-italic">{p.rating.toFixed(1)}</i>
        </div>
      )}
      <div className="flex items-baseline gap-2">
        <strong className="text-[19px]">{money(p.price)}</strong>
        {p.compareAtPrice && <s className="text-13 text-muted">{money(p.compareAtPrice)}</s>}
      </div>
      <button
        type="button"
        className="mt-auto cursor-pointer rounded-pill bg-ink p-2.5 font-bold text-bg transition hover:bg-accent hover:text-white"
      >
        Add to cart
      </button>
    </div>
  );
}
