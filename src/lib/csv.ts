// CSV building for admin exports (the prototype's downloadCSV).

/** Quotes every cell; cells starting with = + - @ (or tab/CR) get a leading ' so spreadsheets don't run them as formulas. */
function cell(value: unknown): string {
  let s = value == null ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, rows: unknown[][]) {
  // BOM so Excel opens UTF-8 (brand names, en dashes) correctly.
  return new Response("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
