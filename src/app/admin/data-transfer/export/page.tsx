import type { Metadata } from "next";
import Link from "next/link";
import { fieldClass } from "@/components/account/field";
import { DataTransferTabs } from "@/components/admin/catalog-tabs";
import { card, FilterChips, primaryButton, SectionTitle, select } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { FORMATS } from "@/lib/data-transfer/export-engine";
import { allowedExporters } from "@/lib/data-transfer/registry";

export const metadata: Metadata = { title: "Export" };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

// Data Transfer → Export (Phase 15): choose an entity and filters; the page shows how many rows match and the
// download streams from the server (large exports never load in the browser).
export default async function DataExport({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = await requireAdminPage("/admin/data-transfer/export", "export.access");
  const exporters = allowedExporters(admin);
  const adapter = exporters.find((e) => e.entity === sp.entity) ?? exporters[0];

  if (!adapter) {
    return (
      <>
        <DataTransferTabs />
        <p className={`${card} max-w-[640px] text-14 text-muted`}>Your role can open Export but can&apos;t export any entity (it needs e.g. products.export).</p>
      </>
    );
  }

  const params = new URLSearchParams();
  for (const f of adapter.filters) if (sp[f.key]) params.set(f.key, sp[f.key]!.slice(0, 200));
  const { filters, errors } = await adapter.parseFilters(params);
  const rows = errors.length ? null : await adapter.count(filters);
  const format = sp.format && FORMATS[sp.format] ? sp.format : "csv";
  params.set("format", format);
  const label = "grid gap-1.5 text-13 text-muted";

  return (
    <>
      <DataTransferTabs />
      <div className="grid max-w-[1000px] gap-4">
        <FilterChips items={exporters.map((e) => ({ label: e.label, href: `/admin/data-transfer/export?entity=${e.entity}`, active: e === adapter }))} />
        <div className={card}>
          <SectionTitle hint="Filter what goes into the file. Empty filters export everything.">Export {adapter.label.toLowerCase()}</SectionTitle>
          <form method="get" className="grid gap-4">
            <input type="hidden" name="entity" value={adapter.entity} />
            <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
              {adapter.filters.map((f) => (
                <label key={f.key} className={label}>
                  <span>{f.label}</span>
                  {f.type === "choice" ? (
                    <select name={f.key} defaultValue={sp[f.key] ?? ""} className={`${select} w-full py-3`}>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={f.key}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      defaultValue={sp[f.key] ?? ""}
                      placeholder={f.type === "text" ? f.placeholder : undefined}
                      min={f.type === "number" ? f.min : undefined}
                      step={f.type === "number" ? f.step : undefined}
                      className={fieldClass}
                    />
                  )}
                </label>
              ))}
              <label className={label}>
                <span>File format</span>
                <select name="format" defaultValue={format} className={`${select} w-full py-3`}>
                  {Object.values(FORMATS).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={`${primaryButton} bg-ink`}>
                Apply filters
              </button>
              <Link href={`/admin/data-transfer/export?entity=${adapter.entity}`} className="text-13 font-bold text-muted hover:text-ink">
                Clear
              </Link>
            </div>
          </form>
        </div>

        <div className={`${card} flex flex-wrap items-center gap-4`}>
          {errors.length ? (
            <p role="alert" className="text-14 text-accent">
              {errors.join(" ")}
            </p>
          ) : rows === 0 ? (
            <p className="text-14 text-muted">No {adapter.label.toLowerCase()} match these filters.</p>
          ) : (
            <>
              <p className="text-14">
                <b>{rows!.toLocaleString("en-US")}</b> {adapter.label.toLowerCase()} match.
              </p>
              <a href={`/admin/data-transfer/export/${adapter.entity}?${params}`} download className="btn text-14">
                ⭳ Download {FORMATS[format].extension.toUpperCase()}
              </a>
            </>
          )}
          <p className="basis-full text-12 text-muted">
            Columns: {adapter.headers.join(", ")}.
            {adapter.entity !== "orders" && " The file can be edited and imported again (Data Transfer → Import)."}
          </p>
        </div>
      </div>
    </>
  );
}
