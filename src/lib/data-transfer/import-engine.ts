// Import engine (Phase 15), shared by every entity: file checks → header mapping → row validation (preview) →
// confirmed import in chunked transactions → per-row outcome and an error report.
import { Prisma } from "@/generated/prisma/client";
import { parseCsv, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import type { Behavior, ImportAdapter, OnError, PlannedRow, RowInput } from "@/lib/data-transfer/types";
import { normalizeHeader } from "@/lib/data-transfer/values";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;
const CHUNK = 100;

export type RowLevel = "valid" | "warning" | "error";
export type RowOutcome = "created" | "updated" | "skipped" | "failed";

/** What the preview and the result pages show per row (stored on the ImportJob). */
export type RowReport = { line: number; key: string; action: PlannedRow<unknown>["action"]; level: RowLevel; messages: string[]; outcome?: RowOutcome };

export type Totals = { rows: number; valid: number; warnings: number; errors: number; create: number; update: number; skip: number };
export type Result = { created: number; updated: number; skipped: number; failed: number };

export type Validation = { fileErrors: string[]; fileWarnings: string[]; header: string[]; reports: RowReport[]; totals: Totals; planned: PlannedRow<unknown>[] };

// ---------- the uploaded file ----------

const CSV_TYPES = ["", "text/csv", "text/plain", "application/csv", "application/vnd.ms-excel", "text/comma-separated-values", "application/octet-stream"];

/**
 * Checks the upload before anything reads it as data: .csv name, a text-like type, size, valid UTF-8, and no
 * binary content. The name is only kept for display (never used as a path).
 */
export async function readUpload(file: unknown): Promise<{ text: string; name: string; size: number } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  const name = file.name.replace(/^.*[\\/]/, "").replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "import.csv";
  if (!/\.csv$/i.test(name)) return { error: "Only .csv files can be imported. In Excel: File → Save As → CSV UTF-8." };
  if (!CSV_TYPES.includes(file.type.toLowerCase())) return { error: `This file (${file.type}) is not a CSV file.` };
  if (file.size > MAX_FILE_BYTES) return { error: `The file is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB; split it into smaller files.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { error: "The file is not UTF-8 text. In Excel: File → Save As → “CSV UTF-8 (comma delimited)”." };
  }
  if (text.includes("\u0000")) return { error: "The file contains binary data, not CSV text." };
  return { text, name, size: file.size };
}

// ---------- validation ----------

function mapHeader(adapter: ImportAdapter, header: string[], behavior: Behavior) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const index = new Map<string, number>();
  header.forEach((raw, i) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    const col = adapter.columns.find((c) => [c.header, c.key, ...(c.aliases ?? [])].some((n) => normalizeHeader(n) === h));
    if (!col) return warnings.push(`Column “${raw}” is not used by the ${adapter.label.toLowerCase()} import and is ignored.`);
    if (col.exportOnly) return;
    if (index.has(col.key)) return errors.push(`Column “${col.header}” appears twice.`);
    index.set(col.key, i);
  });
  const keys = adapter.columns.filter((c) => c.required === "key");
  if (behavior !== "add" && !keys.some((c) => index.has(c.key))) {
    errors.push(`To update records the file needs a ${keys.map((c) => `“${c.header}”`).join(" or ")} column.`);
  }
  if (behavior !== "update") {
    const missing = adapter.columns.filter((c) => c.required === "create" && !index.has(c.key));
    if (missing.length) errors.push(`To add records the file needs these columns: ${missing.map((c) => `“${c.header}”`).join(", ")}.`);
  }
  return { index, errors, warnings };
}

export async function validateCsv(adapter: ImportAdapter, text: string, behavior: Behavior): Promise<Validation> {
  const empty: Totals = { rows: 0, valid: 0, warnings: 0, errors: 0, create: 0, update: 0, skip: 0 };
  const fail = (e: string): Validation => ({ fileErrors: [e], fileWarnings: [], header: [], reports: [], totals: empty, planned: [] });
  if (!adapter.behaviors.includes(behavior)) return fail(`${adapter.label} can't be imported with this behavior.`);

  const table = parseCsv(text);
  if (table.length < 2) return fail("The file has no data rows. The first row must be the column names.");
  if (table.length - 1 > MAX_ROWS) return fail(`At most ${MAX_ROWS} rows per file; split it into smaller files.`);
  const header = table[0];
  const { index, errors, warnings } = mapHeader(adapter, header, behavior);
  if (errors.length) return { ...fail(errors[0]), fileErrors: errors, fileWarnings: warnings, header };

  const ctx = await adapter.load();
  const planned = table.slice(1).map((cells, i): PlannedRow<unknown> => {
    const line = i + 2; // row 1 is the header
    if (cells.length > header.length) {
      return { line, key: `row ${line}`, action: "skip", errors: [`Row has ${cells.length} cells but the header has ${header.length} columns (check commas and quotes).`], warnings: [], changes: [] };
    }
    const row: RowInput = { line, cells, get: (key) => (index.has(key) ? (cells[index.get(key)!] ?? "").trim() : undefined) };
    return adapter.plan(row, ctx, behavior);
  });

  const totals = { ...empty, rows: planned.length };
  const reports = planned.map((p): RowReport => {
    const level: RowLevel = p.errors.length ? "error" : p.warnings.length ? "warning" : "valid";
    totals[level === "valid" ? "valid" : level === "warning" ? "warnings" : "errors"]++;
    if (!p.errors.length) totals[p.action]++;
    const messages = [...p.errors, ...p.warnings, ...(p.errors.length ? [] : p.changes.length ? [`${p.action === "create" ? "New" : "Changes"}: ${p.changes.join(", ")}`] : [])];
    return { line: p.line, key: p.key, action: p.action, level, messages };
  });
  return { fileErrors: [], fileWarnings: warnings, header, reports, totals, planned };
}

// ---------- the confirmed import ----------

class RowWriteError extends Error {}
/** Adapters throw this for a message the admin should see (other errors are logged and shown generically). */
export const rowError = (message: string) => new RowWriteError(message);

function writeFailure(e: unknown) {
  if (e instanceof RowWriteError) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "Conflicts with an existing record (a unique value such as SKU or URL is already used).";
    if (e.code === "P2003" || e.code === "P2025") return "A record it depends on no longer exists.";
  }
  console.error("[import] row failed", e);
  return "Could not be saved.";
}

/**
 * Re-validates the file against the current data (it may have changed since the preview), then writes.
 * onError "stop": nothing is written when any row has an error. Rows are written in chunks of 100, each chunk in
 * one transaction; if a chunk fails, its rows are retried one by one so a bad row can't take good ones with it
 * and no row is ever half-written.
 */
export async function runImport(adapter: ImportAdapter, text: string, behavior: Behavior, onError: OnError) {
  const v = await validateCsv(adapter, text, behavior);
  const byLine = new Map(v.reports.map((r) => [r.line, r]));
  const result: Result = { created: 0, updated: 0, skipped: 0, failed: 0 };
  if (v.fileErrors.length) return { validation: v, result, stopped: v.fileErrors[0] };
  if (onError === "stop" && v.totals.errors > 0) {
    for (const r of v.reports) r.outcome = r.level === "error" ? "failed" : "skipped";
    result.failed = v.totals.errors;
    result.skipped = v.totals.rows - v.totals.errors;
    return { validation: v, result, stopped: `${v.totals.errors} row(s) have errors, so nothing was imported (“stop on errors”).` };
  }

  const todo = v.planned.filter((p) => !p.errors.length && p.write && p.action !== "skip");
  const ordered = adapter.sortForWrite ? adapter.sortForWrite(todo) : todo;
  const done = (p: PlannedRow<unknown>) => {
    byLine.get(p.line)!.outcome = p.action === "create" ? "created" : "updated";
  };
  for (let i = 0; i < ordered.length; i += CHUNK) {
    const chunk = ordered.slice(i, i + CHUNK);
    try {
      await db.$transaction(
        async (tx) => {
          for (const p of chunk) await adapter.write(tx, p.write, p.action as "create" | "update");
        },
        { timeout: 60_000 },
      );
      chunk.forEach(done);
    } catch {
      for (const p of chunk) {
        try {
          await db.$transaction((tx) => adapter.write(tx, p.write, p.action as "create" | "update"));
          done(p);
        } catch (e) {
          const r = byLine.get(p.line)!;
          r.outcome = "failed";
          r.level = "error";
          r.messages = [writeFailure(e), ...r.messages];
        }
      }
    }
  }
  for (const r of v.reports) {
    r.outcome ??= r.level === "error" ? "failed" : "skipped";
    result[r.outcome]++;
  }
  return { validation: v, result, stopped: null };
}

/** Rows with errors (from validation or the import): the original cells plus the row number and the errors. */
export function errorReportCsv(text: string, reports: RowReport[]) {
  const table = parseCsv(text);
  const header = table[0] ?? [];
  const bad = reports.filter((r) => r.level === "error" || r.outcome === "failed");
  return toCsv([["Row", ...header, "Errors"], ...bad.map((r) => [r.line, ...(table[r.line - 1] ?? []), r.messages.join(" | ")])]);
}
