// Admin permissions (Phase 14, Magento-style ACL). Shared by server and browser code, so no server imports.
// A staff account's permissions come from its AdminRole. Super admin is a protected flag on the account,
// not a role and not a permission: it can't be put in a role, so managing roles or users never grants it.

export const PERMISSION_GROUPS = [
  { key: "dashboard", label: "Dashboard", permissions: [["dashboard.view", "View the dashboard"]] },
  {
    key: "products",
    label: "Products",
    permissions: [
      ["products.view", "View products and brands"],
      ["products.create", "Create products"],
      ["products.edit", "Edit products, options, bulk prices, brands"],
      ["products.import", "Import products (CSV)"],
      ["products.export", "Export products (CSV)"],
    ],
  },
  {
    key: "categories",
    label: "Categories",
    permissions: [
      ["categories.view", "View categories"],
      ["categories.create", "Create categories"],
      ["categories.edit", "Edit categories"],
      ["categories.delete", "Delete categories"],
    ],
  },
  {
    key: "reviews",
    label: "Reviews",
    permissions: [
      ["reviews.view", "View reviews"],
      ["reviews.moderate", "Approve, hide and delete reviews; review settings"],
    ],
  },
  {
    key: "orders",
    label: "Orders",
    permissions: [
      ["orders.view", "View orders, invoices and packing slips"],
      ["orders.edit", "Change status, items, address, tracking, notes; mark paid"],
      ["orders.refund", "Refund orders"],
      ["orders.export", "Export orders (CSV)"],
    ],
  },
  {
    key: "quotes",
    label: "Quote requests",
    permissions: [
      ["quotes.view", "View quote requests"],
      ["quotes.edit", "Change status; convert to an order (also needs orders.edit)"],
    ],
  },
  {
    key: "customers",
    label: "Customers",
    permissions: [
      ["customers.view", "View customers"],
      ["customers.edit", "Edit customer details, notes and tax exemption"],
      ["customers.export", "Export customers (CSV)"],
    ],
  },
  {
    key: "coupons",
    label: "Coupons",
    permissions: [
      ["coupons.view", "View coupons"],
      ["coupons.create", "Create coupons"],
      ["coupons.edit", "Switch coupons on and off"],
      ["coupons.delete", "Delete coupons"],
    ],
  },
  {
    key: "settings",
    label: "Settings",
    permissions: [
      ["settings.view", "View store settings"],
      ["settings.edit", "Change store settings, send test emails, run email jobs"],
    ],
  },
  {
    key: "admin_users",
    label: "Admin users",
    permissions: [
      ["admin_users.view", "View admin users"],
      ["admin_users.create", "Create admin users"],
      ["admin_users.edit", "Edit admin users, assign roles, reset passwords"],
      ["admin_users.disable", "Disable and enable admin users"],
      ["admin_users.delete", "Delete admin users"],
    ],
  },
  {
    key: "roles",
    label: "Roles",
    permissions: [
      ["roles.view", "View roles"],
      ["roles.create", "Create roles"],
      ["roles.edit", "Edit roles and their permissions"],
      ["roles.delete", "Delete roles"],
    ],
  },
  { key: "audit_log", label: "Activity log", permissions: [["audit_log.view", "View the security activity log"]] },
] as const satisfies readonly { key: string; label: string; permissions: readonly (readonly [string, string])[] }[];

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number][0];

export const ALL_PERMISSIONS: readonly Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p[0]));

const KNOWN = new Set<string>(ALL_PERMISSIONS);

export const isPermission = (code: string): code is Permission => KNOWN.has(code);

/** Known codes only, no duplicates, in catalog order. */
export const cleanPermissions = (codes: Iterable<string>): Permission[] => {
  const wanted = new Set(codes);
  return ALL_PERMISSIONS.filter((p) => wanted.has(p));
};

/** What the signed-in staff member may do. */
export type AdminAccess = { id: string; isSuperAdmin: boolean; permissions: readonly string[] };

export const can = (a: Pick<AdminAccess, "isSuperAdmin" | "permissions">, p: Permission) => a.isSuperAdmin || a.permissions.includes(p);

export const canAny = (a: Pick<AdminAccess, "isSuperAdmin" | "permissions">, ps: readonly Permission[]) => ps.some((p) => can(a, p));
