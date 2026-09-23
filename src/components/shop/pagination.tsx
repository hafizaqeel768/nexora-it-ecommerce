import Link from "next/link";
import { shopHref, type ShopParams } from "@/lib/catalog-shared";

/** Page numbers around the current page, with gaps: 1 … 4 5 [6] 7 8 … 13 */
function window_(current: number, pages: number): (number | "gap")[] {
  const keep = new Set([1, pages, current - 1, current, current + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

const item = "grid h-10 min-w-10 place-items-center rounded-pill border px-3 text-14 font-semibold transition";

// Not in the prototype (it lists all 14 samples); the real catalog needs pages.
export function Pagination({ params, pages }: { params: ShopParams; pages: number }) {
  if (pages <= 1) return null;
  const current = Math.min(params.page, pages);

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {current > 1 && (
        <Link href={shopHref({ ...params, page: current - 1 })} className={`${item} border-line bg-white hover:border-accent hover:text-accent`}>
          ‹ Prev
        </Link>
      )}
      {window_(current, pages).map((n, i) =>
        n === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-muted">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={shopHref({ ...params, page: n })}
            aria-current={n === current ? "page" : undefined}
            className={`${item} ${n === current ? "border-accent bg-accent text-white" : "border-line bg-white hover:border-accent hover:text-accent"}`}
          >
            {n}
          </Link>
        ),
      )}
      {current < pages && (
        <Link href={shopHref({ ...params, page: current + 1 })} className={`${item} border-line bg-white hover:border-accent hover:text-accent`}>
          Next ›
        </Link>
      )}
    </nav>
  );
}
