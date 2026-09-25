// Export engine (Phase 15): streams any entity in pages of 500 rows, so large exports never sit in memory
// (neither on the server nor in the browser, which just downloads the file).
// Formats are pluggable: add XLSX / JSON / XML by adding an entry to FORMATS.
import { toCsv } from "@/lib/csv";
import type { ExportAdapter } from "@/lib/data-transfer/types";

const PAGE = 500;

export type ExportFormat = {
  id: string;
  label: string;
  extension: string;
  contentType: string;
  begin(headers: string[]): string;
  rows(rows: unknown[][], first: boolean): string;
  end(): string;
};

export const FORMATS: Record<string, ExportFormat> = {
  csv: {
    id: "csv",
    label: "CSV (Excel, Google Sheets)",
    extension: "csv",
    contentType: "text/csv; charset=utf-8",
    // BOM so Excel opens UTF-8 (brand names, en dashes) correctly. toCsv also guards against formula injection.
    begin: (headers) => "﻿" + toCsv([headers]),
    rows: (rows) => (rows.length ? toCsv(rows) : ""),
    end: () => "",
  },
};

export const isFormat = (id: string) => Object.hasOwn(FORMATS, id);

/** A download Response that pages through the adapter while the client reads. */
export function exportResponse<F>(adapter: ExportAdapter<F>, filters: F, format: ExportFormat, filename: string) {
  const encoder = new TextEncoder();
  let cursor: string | null = null;
  let first = true;
  let finished = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(format.begin(adapter.headers)));
    },
    async pull(controller) {
      if (finished) return;
      try {
        const { rows, last } = await adapter.page(filters, cursor, PAGE);
        if (rows.length) controller.enqueue(encoder.encode(format.rows(rows, first)));
        first = false;
        cursor = last;
        if (rows.length < PAGE || !last) {
          finished = true;
          controller.enqueue(encoder.encode(format.end()));
          controller.close();
        }
      } catch (e) {
        console.error("[export] failed", e);
        controller.error(e);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": format.contentType,
      "Content-Disposition": `attachment; filename="${filename}.${format.extension}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
