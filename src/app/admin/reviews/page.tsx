import Link from "next/link";
import { deleteReview, saveReviewSettings, setReviewApproved } from "@/app/actions/reviews";
import { ActionForm, ConfirmButton } from "@/components/admin/action-form";
import { Pager, pageParam } from "@/components/admin/pager";
import { card, CheckField, FilterChips, SectionTitle, textButton } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { shortDate, stars } from "@/lib/format";

export const metadata = { title: "Reviews" };

const PER_PAGE = 30;

type Props = { searchParams: Promise<{ show?: string; page?: string }> };

// Reviews (Phase 12): approve, hide or delete; the product's rating follows its approved reviews.
export default async function AdminReviews({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = await requireAdminPage("/admin/reviews", "reviews.view");
  const canModerate = can(admin, "reviews.moderate");
  const show = sp.show === "approved" || sp.show === "all" ? sp.show : "pending";
  const page = pageParam(sp.page);
  const where = show === "all" ? {} : { approved: show === "approved" };

  const [settings, pending, approved, total, reviews] = await Promise.all([
    getConfig("reviews"),
    db.review.count({ where: { approved: false } }),
    db.review.count({ where: { approved: true } }),
    db.review.count({ where }),
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { product: { select: { name: true, slug: true } }, customer: { select: { email: true } } },
    }),
  ]);
  const href = (s: string, p = 1) => `/admin/reviews?show=${s}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="grid max-w-[900px] gap-4">
      <FilterChips
        items={[
          { label: `Waiting for approval (${pending})`, href: href("pending"), active: show === "pending" },
          { label: `Approved (${approved})`, href: href("approved"), active: show === "approved" },
          { label: `All (${pending + approved})`, href: href("all"), active: show === "all" },
        ]}
      />

      <div className="grid gap-3">
        {reviews.length === 0 && <p className="text-14 text-muted">{show === "pending" ? "Nothing waiting for approval." : "No reviews."}</p>}
        {reviews.map((r) => (
          <article key={r.id} className={`${card} ${r.approved ? "" : "border-[#f59e0b88]"}`}>
            <div className="mb-1.5 flex flex-wrap items-center gap-2.5 text-14">
              <span className="text-star">{stars(r.rating)}</span>
              <b>{r.authorName}</b>
              {r.customer && <span className="text-12 text-muted">{r.customer.email}</span>}
              {!r.customer && <span className="text-12 text-muted">demo review</span>}
              {r.verifiedBuyer && <span className="rounded-pill bg-[#16a34a1a] px-2 py-0.5 text-11 font-bold text-success">✓ Verified buyer</span>}
              {!r.approved && <span className="rounded-pill bg-[#f59e0b22] px-2 py-0.5 text-11 font-bold text-warning">Waiting</span>}
              <span className="ml-auto text-12 text-muted">{shortDate(r.createdAt)}</span>
            </div>
            <Link href={`/product/${r.product.slug}`} target="_blank" className="text-13 font-semibold text-accent hover:underline">
              {r.product.name} ↗
            </Link>
            {r.title && <b className="mt-2 block">{r.title}</b>}
            <p className="mt-1 text-14 whitespace-pre-line">{r.body}</p>
            {canModerate && (
            <div className="mt-3 flex flex-wrap gap-5">
              <form action={setReviewApproved.bind(null, r.id, !r.approved)}>
                <button type="submit" className={textButton}>
                  {r.approved ? "Hide (unapprove)" : "✓ Approve"}
                </button>
              </form>
              <ConfirmButton action={deleteReview.bind(null, r.id)} confirmText="Delete this review permanently?" />
            </div>
            )}
          </article>
        ))}
      </div>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} href={(p) => href(show, p)} />

      <div className={card}>
        <SectionTitle>Review settings</SectionTitle>
        <ActionForm action={saveReviewSettings} submitLabel="Save review settings" readOnly={!canModerate}>
          <CheckField name="enabled" label="Customers can write reviews (when logged in)" defaultChecked={settings.enabled} />
          <CheckField name="requireApproval" label="New and edited reviews need approval here first" defaultChecked={settings.requireApproval} />
          <CheckField name="buyersOnly" label="Only customers who bought the product can review it" defaultChecked={settings.buyersOnly} />
        </ActionForm>
      </div>
    </div>
  );
}
