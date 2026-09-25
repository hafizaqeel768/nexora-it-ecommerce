// Customers for Data Transfer (Phase 15). Rows match by email. Imports contact details only: never passwords,
// accounts or roles. New customers are records without a login (like guest checkouts); they can register later
// with the same email (registering drops unverified contact details, see actions/account.ts).
// Staff accounts are never changed by an import.
import type { Prisma } from "@/generated/prisma/client";
import { COUNTRIES, countryName, isCountryCode } from "@/lib/countries";
import type { ExportAdapter, ImportAdapter, PlannedRow } from "@/lib/data-transfer/types";
import { EMAIL, parseBoolean, parseText } from "@/lib/data-transfer/values";
import { db } from "@/lib/db";

type Existing = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "ADMIN";
  passwordHash: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxExempt: boolean;
  adminNote: string | null;
};
type Ctx = { byEmail: Map<string, Existing>; seen: Map<string, number> };
type Write = { id?: string; data: Prisma.CustomerUncheckedCreateInput };

const FIELDS = [
  ["phone", "phone", "Phone", 40],
  ["address_line", "addressLine", "Address", 200],
  ["city", "city", "City", 100],
  ["state", "state", "State", 100],
  ["postal_code", "postalCode", "ZIP / postal code", 20],
  ["admin_note", "adminNote", "Staff note", 4000],
] as const;

/** "US", "us" or "United States" → "United States" (stored like the admin form stores it). */
function country(value: string): string | null {
  const v = value.trim();
  if (/^[a-z]{2}$/i.test(v) && isCountryCode(v.toUpperCase())) return countryName(v.toUpperCase());
  return COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase())?.name ?? null;
}

export const customerImport: ImportAdapter<Ctx, Write> = {
  entity: "customers",
  label: "Customers",
  permission: "customers.import",
  behaviors: ["add", "update", "add_update"],
  columns: [
    { key: "email", header: "Email", required: "key", type: "email", description: "Finds existing customers; required for every row.", example: "jordan@acme-corp.com" },
    { key: "name", header: "Name", required: "create", type: "text", description: "Full name (max 120 characters).", example: "Jordan Kim" },
    { key: "phone", header: "Phone", required: false, type: "text", description: "Max 40 characters.", example: "+1 512 555 0100" },
    { key: "address_line", header: "Address", aliases: ["address line", "street"], required: false, type: "text", description: "Street and number.", example: "100 Congress Ave" },
    { key: "city", header: "City", required: false, type: "text", description: "", example: "Austin" },
    { key: "state", header: "State", required: false, type: "text", description: "State or region.", example: "TX" },
    { key: "postal_code", header: "ZIP / postal code", aliases: ["zip", "postal code", "postcode"], required: false, type: "text", description: "", example: "78701" },
    { key: "country", header: "Country", required: false, type: "reference", description: "Two-letter code (US) or English name (United States).", example: "US" },
    { key: "tax_exempt", header: "Tax-exempt", aliases: ["tax exempt"], required: false, type: "boolean", values: ["yes", "no"], description: "B2B tax exemption. Only applies to registered accounts.", example: "no" },
    { key: "admin_note", header: "Staff note", aliases: ["note", "admin note"], required: false, type: "text", description: "Private note for staff; customers never see it.", example: "" },
    { key: "account", header: "Account", required: false, type: "text", description: "registered / guest / staff (export only).", example: "", exportOnly: true },
    { key: "email_confirmed", header: "Email confirmed", required: false, type: "boolean", description: "Export only.", example: "", exportOnly: true },
    { key: "created_at", header: "Customer since", required: false, type: "text", description: "Export only.", example: "", exportOnly: true },
    { key: "orders", header: "Orders", required: false, type: "integer", description: "Export only.", example: "", exportOnly: true },
    { key: "total_spent", header: "Total spent", required: false, type: "money", description: "Excluding cancelled orders and refunds (export only).", example: "", exportOnly: true },
    { key: "last_order", header: "Last order", required: false, type: "text", description: "Export only.", example: "", exportOnly: true },
  ],
  notes: [
    "Rows are matched by email. Only the columns in the file are changed; an empty cell clears that detail.",
    "New customers are created without a login. Passwords, accounts and roles are never imported.",
    "Staff accounts (admin users) can't be changed here; use System → Admin users.",
  ],
  sample: [
    { email: "jordan@acme-corp.com", name: "Jordan Kim", phone: "+1 512 555 0100", address_line: "100 Congress Ave", city: "Austin", state: "TX", postal_code: "78701", country: "US", tax_exempt: "no", admin_note: "" },
    { email: "purchasing@example-school.org", name: "Example School District", phone: "", address_line: "", city: "", state: "", postal_code: "", country: "United States", tax_exempt: "yes", admin_note: "Exempt certificate on file" },
  ],

  async load() {
    const all = await db.customer.findMany({
      select: { id: true, email: true, name: true, role: true, passwordHash: true, phone: true, addressLine: true, city: true, state: true, postalCode: true, country: true, taxExempt: true, adminNote: true },
    });
    return { byEmail: new Map(all.map((c) => [c.email.toLowerCase(), c])), seen: new Map() };
  },

  plan(row, ctx, behavior) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const out = (action: PlannedRow<Write>["action"], key: string, extra: Partial<PlannedRow<Write>> = {}): PlannedRow<Write> => ({ line: row.line, key, action, errors, warnings, changes: [], ...extra });

    const email = (row.get("email") ?? "").toLowerCase();
    if (!email) return out("skip", `row ${row.line}`, { errors: ["Email is required."] });
    if (email.length > 200 || !EMAIL.test(email)) return out("skip", email, { errors: [`Email “${email}” is not valid.`] });
    const earlier = ctx.seen.get(email);
    if (earlier) return out("skip", email, { errors: [`Duplicate: ${email} is already in row ${earlier}.`] });
    ctx.seen.set(email, row.line);

    const cur = ctx.byEmail.get(email);
    if (cur?.role === "ADMIN") return out("skip", email, { errors: ["This is a staff account; it can't be changed by an import (System → Admin users)."] });
    if (cur && behavior === "add") return out("skip", email, { warnings: ["Already exists; skipped (behavior: Add)."] });
    if (!cur && behavior === "update") return out("skip", email, { warnings: ["No customer with this email; skipped (behavior: Update)."] });

    const nameCell = row.get("name");
    let name = cur?.name ?? "";
    if (nameCell) {
      const r = parseText(nameCell, "Name", 120);
      if (r.error !== undefined) errors.push(r.error);
      else name = r.value;
    }
    if (!name) errors.push("Name is required.");

    const data: Prisma.CustomerUncheckedCreateInput = { email, name };
    const changes: string[] = [];
    if (cur && name !== cur.name) changes.push("name");
    for (const [key, field, label, max] of FIELDS) {
      const v = row.get(key);
      if (v === undefined) continue;
      const r = parseText(v, label, max);
      if (r.error !== undefined) {
        errors.push(r.error);
        continue;
      }
      data[field] = r.value || null;
      if (cur && (r.value || null) !== cur[field]) changes.push(label.toLowerCase());
    }
    const c = row.get("country");
    if (c !== undefined) {
      const value = c ? country(c) : null;
      if (c && !value) errors.push(`Country “${c}” not recognised (use a two-letter code like US).`);
      else {
        data.country = value;
        if (cur && value !== cur.country) changes.push("country");
      }
    }
    const tx = row.get("tax_exempt");
    if (tx) {
      const r = parseBoolean(tx, "Tax-exempt");
      if (r.error !== undefined) errors.push(r.error);
      else if (!cur?.passwordHash) {
        if (r.value) warnings.push("Tax exemption only applies to registered accounts; ignored for this customer.");
      } else {
        data.taxExempt = r.value;
        if (r.value !== cur.taxExempt) changes.push(r.value ? "tax-exempt" : "pays tax");
      }
    }
    if (errors.length) return out(cur ? "update" : "create", email);
    if (!cur) return out("create", email, { write: { data } });
    if (!changes.length) return out("skip", email);
    const { email: _email, ...update } = data;
    void _email;
    return out("update", email, { changes, write: { id: cur.id, data: update as Prisma.CustomerUncheckedCreateInput } });
  },

  async write(tx, w, action) {
    if (action === "create") {
      await tx.customer.create({ data: w.data });
      return;
    }
    // Re-checked inside the transaction: the account may have become staff since the preview.
    const res = await tx.customer.updateMany({ where: { id: w.id, role: "CUSTOMER" }, data: w.data });
    if (res.count !== 1) throw new Error("Customer changed or became a staff account");
  },
};

// ---------- export ----------

type Filters = { email: string; account: "registered" | "guest" | "staff" | "tax_exempt" | null; from: Date | null; to: Date | null };

const where = (f: Filters): Prisma.CustomerWhereInput => ({
  ...(f.email ? { email: { contains: f.email, mode: "insensitive" } } : {}),
  ...(f.account === "registered" ? { passwordHash: { not: null }, role: "CUSTOMER" } : {}),
  ...(f.account === "guest" ? { passwordHash: null } : {}),
  ...(f.account === "staff" ? { role: "ADMIN" } : {}),
  ...(f.account === "tax_exempt" ? { taxExempt: true } : {}),
  ...(f.from || f.to ? { createdAt: { ...(f.from && { gte: f.from }), ...(f.to && { lt: f.to }) } } : {}),
});

/** "2026-09-01" → that day 00:00 UTC; `end` → the day after (so "to" includes the whole day). */
export function parseDay(value: string | null, label: string, errors: string[], end = false): Date | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    errors.push(`${label} must be a date (YYYY-MM-DD).`);
    return null;
  }
  const d = new Date(`${v}T00:00:00.000Z`);
  if (end) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const customerExport: ExportAdapter<Filters> = {
  entity: "customers",
  label: "Customers",
  permission: "customers.export",
  filters: [
    { key: "email", label: "Email contains", type: "text" },
    {
      key: "account",
      label: "Status",
      type: "choice",
      options: [
        { value: "", label: "Any" },
        { value: "registered", label: "Registered" },
        { value: "guest", label: "Guest / no login" },
        { value: "tax_exempt", label: "Tax-exempt" },
        { value: "staff", label: "Staff" },
      ],
    },
    { key: "from", label: "Customer since, from", type: "date" },
    { key: "to", label: "Customer since, to", type: "date" },
  ],
  async parseFilters(p) {
    const errors: string[] = [];
    const account = p.get("account");
    const filters: Filters = {
      email: (p.get("email") ?? "").trim().slice(0, 200),
      account: account === "registered" || account === "guest" || account === "staff" || account === "tax_exempt" ? account : null,
      from: parseDay(p.get("from"), "From", errors),
      to: parseDay(p.get("to"), "To", errors, true),
    };
    if (filters.from && filters.to && filters.from >= filters.to) errors.push("“From” is after “To”.");
    return { filters, errors };
  },
  count: (f) => db.customer.count({ where: where(f) }),
  headers: customerImport.columns.map((c) => c.header),
  async page(f, cursor, take) {
    const rows = await db.customer.findMany({ where: where(f), orderBy: { id: "asc" }, take, ...(cursor && { cursor: { id: cursor }, skip: 1 }) });
    // Order stats for this page: by account or by email (guest orders), like Admin → Customers.
    const emails = rows.map((c) => c.email);
    const orders = emails.length
      ? await db.order.findMany({
          where: { OR: [{ customerId: { in: rows.map((c) => c.id) } }, { email: { in: emails, mode: "insensitive" } }] },
          select: { customerId: true, email: true, status: true, total: true, refundedTotal: true, createdAt: true },
        })
      : [];
    return {
      last: rows.at(-1)?.id ?? null,
      rows: rows.map((c) => {
        const mine = orders.filter((o) => o.customerId === c.id || o.email.toLowerCase() === c.email.toLowerCase());
        const spent = mine.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + Number(o.total) - Number(o.refundedTotal), 0);
        const last = mine.reduce<Date | null>((d, o) => (!d || o.createdAt > d ? o.createdAt : d), null);
        return [
          c.email,
          c.name,
          c.phone,
          c.addressLine,
          c.city,
          c.state,
          c.postalCode,
          c.country,
          c.taxExempt ? "yes" : "no",
          c.adminNote,
          c.role === "ADMIN" ? "staff" : c.passwordHash ? "registered" : "guest",
          c.emailVerifiedAt ? "yes" : "no",
          c.createdAt,
          mine.length,
          spent.toFixed(2),
          last,
        ];
      }),
    };
  },
};
