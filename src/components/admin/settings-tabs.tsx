"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings", label: "Store details" },
  { href: "/admin/settings/shipping", label: "Shipping" },
  { href: "/admin/settings/tax", label: "Tax" },
  { href: "/admin/settings/payments", label: "Payments" },
  { href: "/admin/settings/checkout", label: "Checkout & stock" },
  { href: "/admin/settings/email", label: "Email" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="mb-5 flex gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {TABS.map((t) => {
        const on = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 py-2.5 text-14 font-semibold whitespace-nowrap ${on ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
