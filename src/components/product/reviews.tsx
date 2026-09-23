import Link from "next/link";
import { ReviewForm, type OwnReview } from "@/components/product/review-form";
import { stars } from "@/lib/format";

type Review = { id: string; author: string; rating: number; title: string | null; body: string; verified: boolean; date: string };

/** Who may write: "form" (signed in and allowed), "login", "buyers" (buyers only, hasn't bought), "off". */
export type ReviewAccess = { mode: "form" | "login" | "buyers" | "off"; productId: string; slug: string; own: OwnReview | null };

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Customer reviews (the prototype's reviewsHTML): approved reviews, and the "Write a review" form (Phase 12).
export function Reviews({ reviews, access }: { reviews: Review[]; access: ReviewAccess }) {
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => Math.round(r.rating) === s).length }));
  const max = Math.max(1, ...dist.map((d) => d.n));

  return (
    <section className="mx-auto mt-14 max-w-[900px]" aria-labelledby="reviews-title">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <h2 id="reviews-title" className="text-[clamp(22px,3vw,28px)] font-bold tracking-[-.5px]">
          Customer reviews
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-3">
            <b className="text-32 tracking-[-1px]">{avg.toFixed(1)}</b>
            <div className="text-star">
              {stars(avg)}
              <small className="block text-caption text-muted">
                {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </small>
            </div>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="rounded-14 border border-dashed border-line bg-white p-5 text-muted">No reviews yet.</p>
      ) : (
        <>
          <div className="mb-[26px] grid max-w-[340px] gap-1.5">
            {dist.map(({ s, n }) => (
              <div key={s} className="grid grid-cols-[32px_1fr_26px] items-center gap-2.5 rounded-8 bg-[#f3f4f6] px-2 py-[5px] text-caption text-muted">
                <span>{s}★</span>
                <i className="block h-[7px] rounded-pill bg-[linear-gradient(90deg,#f5a524,#f59e0b)]" style={{ width: `${(n / max) * 100}%` }} />
                <em className="not-italic">{n}</em>
              </div>
            ))}
          </div>
          <div className="mb-7 grid gap-3.5">
            {reviews.slice(0, 6).map((r) => (
              <article key={r.id} className="rounded-14 border border-line bg-white p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <b>{r.author}</b>
                  <span className="text-star">{stars(r.rating)}</span>
                  {r.verified && <span className="rounded-pill bg-[#16a34a1a] px-2 py-0.5 text-11 font-bold text-success">✓ Verified buyer</span>}
                  <small className="ml-auto text-muted">{date(r.date)}</small>
                </div>
                {r.title && <b className="mb-1 block text-15">{r.title}</b>}
                <p className="text-14 leading-[1.6] whitespace-pre-line">{r.body}</p>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="mt-2">
        {access.mode === "form" && <ReviewForm productId={access.productId} own={access.own} />}
        {access.mode === "login" && (
          <p className="rounded-14 border border-line bg-white p-5 text-14 text-muted">
            <Link href={`/login?next=${encodeURIComponent(`/product/${access.slug}#reviews-title`)}`} className="font-bold text-accent">
              Log in
            </Link>{" "}
            to write a review.
          </p>
        )}
        {access.mode === "buyers" && <p className="rounded-14 border border-line bg-white p-5 text-14 text-muted">Only customers who bought this product can review it.</p>}
      </div>
    </section>
  );
}
