// Formatting helpers shared by server and client components.

/** $1,234.50 — same output as the prototype's money(). */
export const money = (value: number | string | { toString(): string }) =>
  "$" +
  Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ★★★★☆ for a 0–5 rating, as in the prototype's stars(). */
export const stars = (rating: number) => {
  const full = Math.round(rating);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
};

/** Sep 23, 2026 — the prototype's a_fd(). */
export const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Badge colours from the prototype's A_ST, for order and quote statuses. */
export const STATUS_COLOR: Record<string, string> = {
  PENDING: "#d97706",
  PROCESSING: "#2563eb",
  SHIPPED: "#7c3aed",
  DELIVERED: "#16a34a",
  CANCELLED: "#dc2626",
  NEW: "#d97706",
  CONTACTED: "#2563eb",
  WON: "#16a34a",
  CLOSED: "#6b7280",
};

/** PENDING → Pending */
export const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
