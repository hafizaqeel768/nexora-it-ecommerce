// Starts an export download (Phase 15): validated filters, audit entry, streamed file.
import { audit } from "@/lib/audit";
import { exportResponse, FORMATS, isFormat } from "@/lib/data-transfer/export-engine";
import type { ExportAdapter } from "@/lib/data-transfer/types";

export async function exportDownload(adapter: ExportAdapter, params: URLSearchParams, actor: { id: string; email: string }) {
  const format = params.get("format") || "csv";
  if (!isFormat(format)) return new Response("Unknown export format.", { status: 400 });
  const { filters, errors } = await adapter.parseFilters(params);
  if (errors.length) return new Response(`Export filters are not valid: ${errors.join(" ")}`, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const rows = await adapter.count(filters);
  const used = Object.fromEntries([...params].filter(([k, v]) => v && k !== "format" && adapter.filters.some((f) => f.key === k)));
  await audit({ actor, action: "data.exported", targetType: "data_transfer", targetLabel: adapter.label, details: { format, rows, filters: used } });
  return exportResponse(adapter, filters, FORMATS[format], `${adapter.entity}-${new Date().toISOString().slice(0, 10)}`);
}
