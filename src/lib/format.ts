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
