import { stars } from "@/lib/format";

type Review = { id: string; author: string; rating: number; body: string; date: string };

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Customer reviews (the prototype's reviewsHTML). Writing reviews needs accounts (Phase 8).
export function Reviews({ reviews }: { reviews: Review[] }) {
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
                  <small className="ml-auto text-muted">{date(r.date)}</small>
                </div>
                <p className="text-14 leading-[1.6]">{r.body}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
