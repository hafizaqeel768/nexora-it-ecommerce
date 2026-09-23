import Link from "next/link";

// Prev / next links for long admin tables; `href(page)` keeps the other filters.
export function Pager({ page, pages, total, href }: { page: number; pages: number; total: number; href: (page: number) => string }) {
  if (pages <= 1) return <p className="mt-3 text-13 text-muted">{total} total</p>;
  const link = "rounded-pill border border-line bg-white px-3.5 py-1.5 text-13 hover:border-accent";
  return (
    <div className="mt-3 flex items-center gap-3 text-13 text-muted">
      {page > 1 && (
        <Link href={href(page - 1)} className={link}>
          ← Prev
        </Link>
      )}
      <span>
        Page {page} of {pages} · {total} total
      </span>
      {page < pages && (
        <Link href={href(page + 1)} className={link}>
          Next →
        </Link>
      )}
    </div>
  );
}

/** ?page= → 1..∞ */
export const pageParam = (v: string | undefined) => Math.max(1, Number.parseInt(v ?? "1", 10) || 1);
