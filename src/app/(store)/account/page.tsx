import type { Metadata } from "next";
import Link from "next/link";
import { AddressForm, ProfileForm } from "@/components/account/account-forms";
import { VerifyEmailBanner } from "@/components/account/password-forms";
import { SignInPrompt } from "@/components/account/sign-in-prompt";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { money, shortDate, statusLabel } from "@/lib/format";
import { accountOrdersWhere, getViewer, type Viewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "My Account" };

type Props = { searchParams: Promise<{ t?: string }> };

const tabs = [
  { key: "orders", label: "Orders" },
  { key: "addr", label: "Addresses" },
  { key: "profile", label: "Profile" },
] as const;

// My account (the prototype's accHTML): orders, saved address, profile.
export default async function AccountPage({ searchParams }: Props) {
  const { t } = await searchParams;
  const viewer = await getViewer();
  const tab = tabs.find((x) => x.key === t)?.key ?? "orders";

  return (
    <main className="min-h-[80vh] pt-12 pb-[60px]">
      <div className="wrap">
        {!viewer ? (
          <SignInPrompt text="Sign in to view your orders, addresses and profile." next={`/account${t ? `?t=${t}` : ""}`} />
        ) : (
          <>
            <h1 className="text-[clamp(26px,4vw,36px)] leading-[1.15] font-bold tracking-[-.8px]">My account</h1>
            <p className="section-sub mt-2">Welcome back, {viewer.name}.</p>
            {!viewer.emailVerifiedAt && <VerifyEmailBanner email={viewer.email} />}
            <nav aria-label="Account" className="mt-[18px] mb-[26px] flex gap-5 border-b border-line">
              {tabs.map((x) => (
                <Link
                  key={x.key}
                  href={`/account?t=${x.key}`}
                  aria-current={tab === x.key ? "page" : undefined}
                  className={`-mb-px border-b-2 px-1 py-2.5 text-14 font-semibold ${
                    tab === x.key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {x.label}
                </Link>
              ))}
            </nav>
            {tab === "orders" && <OrderList viewer={viewer} />}
            {tab === "addr" && (
              <AddressForm
                address={{
                  line: viewer.addressLine ?? "",
                  city: viewer.city ?? "",
                  state: viewer.state ?? "",
                  postalCode: viewer.postalCode ?? "",
                  country: viewer.country ?? "United States",
                }}
              />
            )}
            {tab === "profile" && <ProfileForm name={viewer.name} email={viewer.email} phone={viewer.phone ?? ""} />}
          </>
        )}
      </div>
    </main>
  );
}

async function OrderList({ viewer }: { viewer: Viewer }) {
  const orders = await db.order.findMany({
    where: accountOrdersWhere(viewer),
    orderBy: { createdAt: "desc" },
    include: {
      items: { select: { name: true, quantity: true }, orderBy: { id: "asc" } },
      emails: { where: { sentAt: { not: null } }, orderBy: { sentAt: "desc" }, take: 1, select: { kind: true, orderStatus: true, sentAt: true } },
    },
  });

  if (!orders.length) {
    return (
      <p className="section-sub">
        No orders yet.{" "}
        <Link href="/shop" className="font-semibold text-accent">
          Start shopping →
        </Link>
      </p>
    );
  }

  return (
    <div className="grid max-w-[760px] gap-3">
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/order/${o.id}`}
          className="block rounded-14 border border-line bg-white p-4 transition-colors hover:border-accent"
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-3.5">
            <b>{o.number}</b>
            <StatusBadge status={o.status} />
            <span className="text-13 text-muted">{shortDate(o.createdAt)}</span>
            {o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && (
              <span className="text-12 text-warning">Awaiting payment</span>
            )}
            <b className="ml-auto">{money(o.total)}</b>
          </div>
          <div className="text-ui text-muted">{o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</div>
          {o.emails[0]?.sentAt && (
            <div className="mt-1.5 text-12 text-success">
              ✉️ Email sent: {o.emails[0].kind === "CONFIRMATION" ? "order received" : statusLabel(o.emails[0].orderStatus).toLowerCase()} (
              {shortDate(o.emails[0].sentAt)})
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
