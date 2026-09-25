import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions/customers";
import { toggleTaxExempt } from "@/app/actions/settings";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { OrderTable } from "@/components/admin/order-table";
import { SwitchButton } from "@/components/admin/switch-button";
import { card, cardTitle, Kpi, select } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { COUNTRIES } from "@/lib/countries";
import { db } from "@/lib/db";
import { money, shortDate, stars } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

const pill = "rounded-pill px-2.5 py-0.5 text-12 font-bold";

// Customer detail (Phase 13): profile, stats, orders (by account or email), quotes, reviews, saved cart,
// editable contact details, private staff note and tax exemption.
export default async function AdminCustomer({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdminPage(`/admin/customers/${id}`, "customers.view");
  const canEdit = can(admin, "customers.edit");
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      quotes: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, createdAt: true, status: true, quantity: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 20, include: { product: { select: { name: true, slug: true } } } },
      savedCart: true,
      _count: { select: { wishlistItems: true } },
    },
  });
  if (!c) notFound();

  const orderWhere = { OR: [{ customerId: c.id }, { email: { equals: c.email, mode: "insensitive" as const } }] };
  const [orders, counted] = await Promise.all([
    db.order.findMany({ where: orderWhere, orderBy: { createdAt: "desc" } }),
    db.order.aggregate({ where: { ...orderWhere, status: { not: "CANCELLED" } }, _sum: { total: true, refundedTotal: true }, _count: true }),
  ]);
  const spent = Number(counted._sum.total ?? 0) - Number(counted._sum.refundedTotal ?? 0);
  const cartLines = Array.isArray(c.savedCart?.lines) ? (c.savedCart!.lines as { quantity: number }[]) : [];
  const countryCode = COUNTRIES.find((x) => x.name === c.country)?.code ?? "";

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/customers" className="text-accent">
          Customers
        </Link>{" "}
        / {c.name}
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h2 className="text-22 font-bold">{c.name}</h2>
        <a href={`mailto:${c.email}`} className="text-14 text-accent">
          {c.email}
        </a>
        {c.role === "ADMIN" && <span className={`${pill} bg-accent-soft text-accent`}>Admin</span>}
        <span className={`${pill} bg-[#f3f4f6] text-muted`}>{c.passwordHash ? "Registered" : "Guest"}</span>
        {c.passwordHash && (
          <span className={`${pill} ${c.emailVerifiedAt ? "bg-[#16a34a1a] text-success" : "bg-[#f59e0b22] text-warning"}`}>
            {c.emailVerifiedAt ? "Email confirmed" : "Email not confirmed"}
          </span>
        )}
        {c.taxExempt && <span className={`${pill} bg-[#2563eb1a] text-[#2563eb]`}>Tax-exempt</span>}
      </div>

      <div className="mb-4 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
        <Kpi label="Orders" value={orders.length} note={`${counted._count} not cancelled`} />
        <Kpi label="Spent" value={money(spent)} note="excl. cancelled and refunds" />
        <Kpi label="Average order" value={counted._count ? money(spent / counted._count) : "—"} note="per order" />
        <Kpi label="Customer since" value={shortDate(c.registeredAt ?? c.createdAt)} note={orders.length ? `last order ${shortDate(orders[0].createdAt)}` : "no orders yet"} />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4 max-[1100px]:grid-cols-1">
        <div className="grid gap-4">
          <div className={card}>
            <h3 className={cardTitle}>Orders</h3>
            <OrderTable orders={orders} />
            <p className="mt-2 text-12 text-muted">Includes guest orders placed with this email address.</p>
          </div>
          {c.quotes.length > 0 && (
            <div className={card}>
              <h3 className={cardTitle}>Quote requests</h3>
              {c.quotes.map((q) => (
                <div key={q.id} className="flex items-center gap-3 border-b border-[#f0f1f3] py-2 text-14 last:border-0">
                  <Link href={`/admin/quotes/${q.id}`} className="font-bold hover:text-accent">
                    {q.number}
                  </Link>
                  <span className="text-muted">{shortDate(q.createdAt)}</span>
                  <span className="text-muted">qty {q.quantity ?? "—"}</span>
                  <span className="ml-auto">
                    <StatusBadge status={q.status} />
                  </span>
                </div>
              ))}
            </div>
          )}
          {c.reviews.length > 0 && (
            <div className={card}>
              <h3 className={cardTitle}>Reviews</h3>
              {c.reviews.map((r) => (
                <div key={r.id} className="border-b border-[#f0f1f3] py-2 text-14 last:border-0">
                  <span className="text-star">{stars(r.rating)}</span>{" "}
                  <Link href={`/product/${r.product.slug}`} target="_blank" className="hover:text-accent">
                    {r.product.name}
                  </Link>
                  {!r.approved && <span className="ml-2 text-12 text-warning">waiting for approval</span>}
                  <p className="text-13 text-muted">{r.title ?? r.body.slice(0, 120)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div className={card}>
            <h3 className={cardTitle}>Details</h3>
            <ActionForm action={updateCustomer.bind(null, c.id)} submitLabel="Save customer" readOnly={!canEdit}>
              <Field label="Name" name="name" defaultValue={c.name} />
              <Field label="Phone" name="phone" defaultValue={c.phone ?? ""} />
              <Field label="Address" name="line" defaultValue={c.addressLine ?? ""} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="City" name="city" defaultValue={c.city ?? ""} />
                <Field label="State" name="state" defaultValue={c.state ?? ""} />
                <Field label="ZIP" name="postalCode" defaultValue={c.postalCode ?? ""} />
                <label className="grid gap-1.5 text-13 text-muted">
                  <span>Country</span>
                  <select name="country" defaultValue={countryCode} className={`${select} w-full py-3`}>
                    <option value="">—</option>
                    {COUNTRIES.map((x) => (
                      <option key={x.code} value={x.code}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 text-13 text-muted">
                <span>Private note (staff only)</span>
                <textarea name="adminNote" rows={4} defaultValue={c.adminNote ?? ""} placeholder="E.g. net-30 terms agreed, prefers delivery before noon…" className={fieldClass} />
              </label>
            </ActionForm>
          </div>
          <div className={card}>
            <h3 className={cardTitle}>Account</h3>
            <div className="flex items-center justify-between gap-3 text-14">
              <span>
                Tax-exempt
                <small className="block text-12 text-muted">No tax at checkout when logged in</small>
              </span>
              {c.passwordHash ? (
                <SwitchButton readOnly={!canEdit} on={c.taxExempt} action={toggleTaxExempt.bind(null, c.id)} label={`${c.name}: ${c.taxExempt ? "tax-exempt" : "pays tax"}`} />
              ) : (
                <span className="text-12 text-muted">Guests can&apos;t be exempt</span>
              )}
            </div>
            <p className="mt-3 text-13 text-muted">
              Wishlist: {c._count.wishlistItems} product{c._count.wishlistItems === 1 ? "" : "s"}
              {c.savedCart && cartLines.length > 0 && (
                <>
                  <br />
                  Saved cart: {cartLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)} item(s), last changed {shortDate(c.savedCart.changedAt)}
                  {c.savedCart.remindedAt ? " (reminder sent)" : ""}
                </>
              )}
            </p>
            {c.role === "ADMIN" && (
              <p className="mt-2 text-12 text-muted">
                This is a staff account.{" "}
                {can(admin, "admin_users.view") ? (
                  <Link href={`/admin/users/${c.id}`} className="font-bold text-accent">
                    Role and access: Admin users →
                  </Link>
                ) : (
                  "Its role and access are managed under System → Admin users."
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
