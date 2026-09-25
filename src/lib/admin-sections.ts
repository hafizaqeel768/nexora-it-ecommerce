// Where each admin sidebar section and tab leads, and the permission it needs (Phase 14).
// Used for showing only what the signed-in admin may open; the pages check the permission again themselves.
import { can, type AdminAccess, type Permission } from "@/lib/acl";

type Link = { href: string; label: string; permission: Permission };

export const CATALOG_TABS: Link[] = [
  { href: "/admin/products", label: "Products", permission: "products.view" },
  { href: "/admin/categories", label: "Categories", permission: "categories.view" },
  { href: "/admin/brands", label: "Brands", permission: "products.view" },
  { href: "/admin/products/import", label: "Import CSV", permission: "products.import" },
];

export const SYSTEM_TABS: Link[] = [
  { href: "/admin/users", label: "Admin users", permission: "admin_users.view" },
  { href: "/admin/roles", label: "Roles", permission: "roles.view" },
  { href: "/admin/audit", label: "Activity log", permission: "audit_log.view" },
];

/** Sidebar sections by key (see AdminNav); a section opens its first tab the admin may see. */
export const SECTIONS: Record<string, Link[]> = {
  dashboard: [{ href: "/admin", label: "Dashboard", permission: "dashboard.view" }],
  catalog: CATALOG_TABS,
  orders: [{ href: "/admin/orders", label: "Orders", permission: "orders.view" }],
  quotes: [{ href: "/admin/quotes", label: "Quotes", permission: "quotes.view" }],
  reviews: [{ href: "/admin/reviews", label: "Reviews", permission: "reviews.view" }],
  customers: [{ href: "/admin/customers", label: "Customers", permission: "customers.view" }],
  coupons: [{ href: "/admin/coupons", label: "Coupons", permission: "coupons.view" }],
  settings: [{ href: "/admin/settings", label: "Settings", permission: "settings.view" }],
  system: SYSTEM_TABS,
};

export const allowedTabs = (admin: AdminAccess, tabs: Link[]) => tabs.filter((t) => can(admin, t.permission));

/** Section key → the link the sidebar should use; sections the admin can't open are left out. */
export function sectionLinks(admin: AdminAccess): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, links] of Object.entries(SECTIONS)) {
    const first = allowedTabs(admin, links)[0];
    if (first) out[key] = first.href;
  }
  return out;
}
