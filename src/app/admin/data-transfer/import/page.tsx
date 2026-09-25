import type { Metadata } from "next";
import Link from "next/link";
import { DataTransferTabs } from "@/components/admin/catalog-tabs";
import { DataImportForm, type ImportGuide } from "@/components/admin/data-import-form";
import { IMPORT_STATUS_LABEL as STATUS_LABEL } from "@/components/admin/import-status";
import { card, EmptyRow, row, SectionTitle, table, td, th } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { MAX_FILE_BYTES, MAX_ROWS, type Result, type Totals } from "@/lib/data-transfer/import-engine";
import { allowedImporters } from "@/lib/data-transfer/registry";
import { BEHAVIORS } from "@/lib/data-transfer/types";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Import" };

type Props = { searchParams: Promise<{ entity?: string }> };

// Data Transfer → Import (Phase 15): upload, validate & preview, then confirm on the next page.
export default async function DataImport({ searchParams }: Props) {
  const { entity } = await searchParams;
  const admin = await requireAdminPage("/admin/data-transfer/import", "import.access");
  const importers = allowedImporters(admin);
  const jobs = importers.length
    ? await db.importJob.findMany({
        where: { entity: { in: importers.map((i) => i.entity) } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, entity: true, fileName: true, status: true, totals: true, result: true, createdByEmail: true, createdAt: true },
      })
    : [];
  const guides: ImportGuide[] = importers.map((a) => ({
    entity: a.entity,
    label: a.label,
    behaviors: a.behaviors.map((b) => ({ value: b, ...BEHAVIORS[b] })),
    notes: a.notes,
    columns: a.columns.map((c) => ({ header: c.header, required: c.exportOnly ? "export" : c.required || "", description: c.description, example: c.example, values: c.values })).filter((c) => c.required !== "export"),
  }));

  return (
    <>
      <DataTransferTabs />
      <div className="grid max-w-[1000px] gap-4">
        <div className={card}>
          <SectionTitle hint="Add or update many records at once from a spreadsheet saved as CSV. Orders can be exported but not imported (see below).">
            Import
          </SectionTitle>
          {guides.length ? (
            <DataImportForm guides={guides} initial={entity ?? ""} maxMb={MAX_FILE_BYTES / 1024 / 1024} maxRows={MAX_ROWS} />
          ) : (
            <p className="text-14 text-muted">Your role can open Import but can&apos;t import any entity (it needs e.g. products.import).</p>
          )}
        </div>

        <div className={card}>
          <h3 className="mb-3 text-16 font-bold">Recent imports</h3>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>File</th>
                <th className={th}>Entity</th>
                <th className={th}>Status</th>
                <th className={th}>Rows</th>
                <th className={th}>By</th>
                <th className={th}>When</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length ? (
                jobs.map((j) => {
                  const t = j.totals as unknown as Totals;
                  const r = j.result as unknown as Result | null;
                  return (
                    <tr key={j.id} className={row}>
                      <td className={td}>
                        <Link href={`/admin/data-transfer/import/${j.id}`} className="font-bold text-accent hover:underline">
                          {j.fileName}
                        </Link>
                      </td>
                      <td className={td}>{j.entity}</td>
                      <td className={td}>{STATUS_LABEL[j.status]}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {r ? `${r.created} new · ${r.updated} updated · ${r.failed} failed` : `${t.rows} rows · ${t.errors} with errors`}
                      </td>
                      <td className={td}>{j.createdByEmail}</td>
                      <td className={`${td} whitespace-nowrap`}>{j.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    </tr>
                  );
                })
              ) : (
                <EmptyRow cols={6}>No imports yet.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-13 text-muted">
          <b className="text-ink">Why no order import?</b> An order is tied to stock, payments (Stripe, refunds), shipping and tax totals and its status history. Importing
          rows would create orders that skip those rules, so orders are only created by checkout or by converting a quote. Orders can be exported.
        </p>
      </div>
    </>
  );
}
