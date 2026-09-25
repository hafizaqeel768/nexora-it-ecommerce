// Cell parsing for imports (Phase 15). Each parser returns { value } or { error } with a message for the row.

export type Parsed<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

const MAX_MONEY = 99_999_999.99;

/** "$1,299.00" → 1299; at most 2 decimals, 0 … 99,999,999.99. */
export function parseMoney(raw: string, label: string): Parsed<number> {
  const s = raw.replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { error: `${label} “${raw}” is not an amount (e.g. 199.99).` };
  const n = Number(s);
  return n > MAX_MONEY ? { error: `${label} is too large.` } : { value: Math.round(n * 100) / 100 };
}

export function parseInteger(raw: string, label: string, min = 0, max = 10_000_000): Parsed<number> {
  const s = raw.replace(/[\s,]/g, "");
  if (!/^-?\d+$/.test(s)) return { error: `${label} “${raw}” must be a whole number.` };
  const n = Number(s);
  if (n < min || n > max) return { error: `${label} must be between ${min} and ${max}.` };
  return { value: n };
}

const YES = ["yes", "y", "true", "1", "on"];
const NO = ["no", "n", "false", "0", "off"];

export function parseBoolean(raw: string, label: string): Parsed<boolean> {
  const s = raw.trim().toLowerCase();
  if (YES.includes(s)) return { value: true };
  if (NO.includes(s)) return { value: false };
  return { error: `${label} “${raw}” must be yes or no.` };
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Text cell: trimmed, length-limited; control characters (except newlines/tabs) are refused. */
export function parseText(raw: string, label: string, max: number): Parsed<string> {
  const s = raw.trim();
  if (s.length > max) return { error: `${label} is longer than ${max} characters.` };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) return { error: `${label} contains control characters.` };
  return { value: s };
}

export const slugify = (s: string, fallback: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Compare-at price", "compare_at_price", "compareAtPrice" → "compareatprice" */
export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
