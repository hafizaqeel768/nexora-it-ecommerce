"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/products/import", label: "Import CSV" },
];

// Tabs across the catalog screens (under the sidebar's "Products").
export function CatalogTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Catalog" className="mb-5 flex gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]">
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
