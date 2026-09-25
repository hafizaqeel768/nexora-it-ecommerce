"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tabs across a group of admin screens (catalog, system). The server passes only tabs the admin may open.
export function AdminTabs({ label, tabs }: { label: string; tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={label} className="mb-5 flex gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {tabs.map((t) => {
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
