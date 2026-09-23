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
  return new Response("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Parses CSV (RFC 4180: quoted fields, "" escapes, commas/newlines inside quotes, CRLF or LF, UTF-8 BOM).
 * Undoes the export's formula guard: a leading ' before = + - @ is removed.
 */
export function parseCsv(input: string): string[][] {
  const src = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const unguard = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);
  return rows.filter((r) => r.some((c) => c.trim() !== "")).map((r) => r.map((c) => unguard(c.trim())));
}
