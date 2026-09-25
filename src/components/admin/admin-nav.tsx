"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar links with the prototype's icons (A_NAV).
const NAV = [
  { key: "dashboard", href: "/admin", label: "Dashboard", title: "Dashboard", icon: <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" /> },
  {
    key: "catalog",
    href: "/admin/products",
    label: "Products",
    title: "Catalog",
    also: ["/admin/categories", "/admin/brands"],
    icon: (
      <>
        <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
        <path d="m3 8 9 5 9-5M12 13v8" />
      </>
    ),
  },
  {
    key: "orders",
    href: "/admin/orders",
    label: "Orders",
    title: "Orders",
    icon: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L21 7H6" />
      </>
    ),
  },
  { key: "quotes", href: "/admin/quotes", label: "Quotes", title: "Quote requests", icon: <path d="M4 5h16v11H8l-4 4z" /> },
  {
    key: "reviews",
    href: "/admin/reviews",
    label: "Reviews",
    title: "Reviews",
    icon: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  },
  {
    key: "customers",
    href: "/admin/customers",
    label: "Customers",
    title: "Customers",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />
      </>
    ),
  },
  {
    key: "coupons",
    href: "/admin/coupons",
    label: "Coupons",
    title: "Coupons",
    icon: (
      <>
        <path d="M3 12V5h7l11 11-7 7z" />
        <circle cx="7.5" cy="9.5" r="1.2" />
      </>
    ),
  },
  {
    key: "settings",
    href: "/admin/settings",
    label: "Settings",
    title: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
  },
  {
    key: "system",
    href: "/admin/users",
    label: "System",
    title: "System",
    also: ["/admin/roles", "/admin/audit"],
    icon: (
      <>
        <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  },
];

type NavItem = { key: string; href: string; label: string; title: string; icon: React.ReactNode; also?: string[] };

const current = (pathname: string) =>
  (NAV as NavItem[]).find((n) =>
    n.href === "/admin" ? pathname === "/admin" : [n.href, ...(n.also ?? [])].some((h) => pathname.startsWith(h)),
  ) ?? NAV[0];

/** `links`: section key → where it opens, only for sections the admin may see (src/lib/admin-sections.ts). */
export function AdminNav({ links }: { links: Record<string, string> }) {
  const active = current(usePathname());
  return (
    <nav aria-label="Admin" className="grid gap-1 max-[900px]:order-3 max-[900px]:flex-[1_1_100%] max-[900px]:grid-flow-col max-[900px]:overflow-x-auto">
      {NAV.filter((n) => links[n.key]).map((n) => (
        <Link
          key={n.key}
          href={links[n.key]}
          aria-current={n === active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-10 px-3 py-[11px] text-14 font-semibold whitespace-nowrap transition duration-150 ${
            n === active ? "bg-accent text-white" : "text-[#c9ccd3] hover:bg-[#ffffff12] hover:text-white"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-[19px] flex-none fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
          >
            {n.icon}
          </svg>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Page title in the top bar, from the current section. */
export function AdminTitle() {
  return <h1 className="text-20 leading-[1.2] font-bold tracking-[-.3px]">{current(usePathname()).title}</h1>;
}
