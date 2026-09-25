import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelImport, confirmImport } from "@/app/actions/data-transfer";
import { DataTransferTabs } from "@/components/admin/catalog-tabs";
import { IMPORT_STATUS_LABEL } from "@/components/admin/import-status";
import { Pager, pageParam } from "@/components/admin/pager";
import { StaffActionButton } from "@/components/admin/staff-forms";
import { card, FilterChips, Kpi, textButton } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import type { Result, RowReport } from "@/lib/data-transfer/import-engine";
import { getJob } from "@/lib/data-transfer/jobs";
import { importer } from "@/lib/data-transfer/registry";
import { BEHAVIORS, type Behavior } from "@/lib/data-transfer/types";

export const metadata: Metadata = { title: "Import preview" };

const PER_PAGE = 100;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string; page?: string }> };

const levelStyle = { valid: "bg-[#16a34a1a] text-success", warning: "bg-[#f59e0b22] text-warning", error: "bg-accent-soft text-accent" } as const;
const outcomeLabel = { created: "Created", updated: "Updated", skipped: "Skipped", failed: "Failed" } as const;
const actionLabel = { create: "New", update: "Update", skip: "No change" } as const;

// Data Transfer → Import, step 2 and 3 (Phase 15): the preview (confirm or cancel), then the result.
export default async function ImportJobPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const admin = await requireAdminPage(`/admin/data-transfer/import/${id}`, "import.access");
  const job = await getJob(admin, id);
  if (!job) notFound();
  const adapter = importer(job.entity)!;
  const t = job.totals;
  const result = job.result as unknown as Result | null;
  const reports = job.rows.reports;
  const done = !!result;
  const bad = reports.filter((r) => r.level === "error" || r.outcome === "failed").length;

  const show = sp.show === "valid" || sp.show === "warning" || sp.show === "error" ? sp.show : "all";
  const shown = show === "all" ? reports : reports.filter((r) => r.level === show);
  const page = pageParam(sp.page);
  const slice = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (s: string, p = 1) => `/admin/data-transfer/import/${id}?${new URLSearchParams({ ...(s !== "all" && { show: s }), ...(p > 1 && { page: String(p) }) })}`;
  const count = (l: RowReport["level"]) => reports.filter((r) => r.level === l).length;
  const blocked = job.onError === "stop" && t.errors > 0;
  const writes = t.create + t.update;

  return (
    <>
      <DataTransferTabs />
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/data-transfer/import" className="text-accent">
          Import
        </Link>{" "}
        / {job.fileName}
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h2 className="text-22 font-bold">{job.fileName}</h2>
        <span className="rounded-pill bg-[#f3f4f6] px-2.5 py-0.5 text-12 font-bold">{IMPORT_STATUS_LABEL[job.status]}</span>
      </div>
      <p className="mb-4 text-13 text-muted">
        {adapter.label} · {BEHAVIORS[job.behavior as Behavior]?.label ?? job.behavior} · rows with errors: {job.onError === "stop" ? "stop, import nothing" : "skip"} ·{" "}
        {(job.fileSize / 1024).toFixed(1)} KB · by {job.createdByEmail}, {job.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
      </p>

      {done ? (
        <div className="mb-4 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
          <Kpi label="Imported (new)" value={result.created} note="records created" />
          <Kpi label="Updated" value={result.updated} note="records changed" />
          <Kpi label="Skipped" value={result.skipped} note="no change or not matching the behavior" />
          <Kpi label="Failed" value={result.failed} note="see the rows below" />
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2">
          <Kpi label="Total rows" value={t.rows} note={`${t.create} new · ${t.update} changes`} />
          <Kpi label="Valid" value={t.valid} note="ready to import" />
          <Kpi label="Warnings" value={t.warnings} note="imported, but check them" />
          <Kpi label="Errors" value={t.errors} note={job.onError === "stop" ? "nothing will be imported" : "these rows are skipped"} />
        </div>
      )}

      {job.rows.fileWarnings.length > 0 && (
        <div className="mb-4 rounded-12 border border-[#f59e0b66] bg-[#fffbeb] px-4 py-3 text-14">
          {job.rows.fileWarnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className={`${card} mb-4 flex flex-wrap items-start gap-4`}>
        {job.status === "VALIDATED" && job.content ? (
          <>
            {blocked ? (
              <p className="text-14">
                <b className="text-accent">{t.errors} row(s) have errors</b> and you chose “stop, import nothing”. Fix the file (download the error report) and upload it
                again.
              </p>
            ) : writes === 0 ? (
              <p className="text-14">Nothing to import: every row is unchanged, skipped or has errors.</p>
            ) : (
              <StaffActionButton
                action={confirmImport.bind(null, id)}
                label={`Confirm import: ${t.create} new, ${t.update} updates${t.errors ? ` (skip ${t.errors} with errors)` : ""}`}
                confirmText={`Import ${writes} ${adapter.label.toLowerCase()} now?`}
              />
            )}
            <StaffActionButton action={cancelImport.bind(null, id)} label="Cancel" />
            <p className="basis-full text-12 text-muted">The file is checked again when you confirm, in case the data changed since this preview.</p>
          </>
        ) : job.status === "VALIDATED" ? (
          <p className="text-14 text-muted">This upload has expired. Upload the file again.</p>
        ) : (
          <Link href={`/admin/data-transfer/import?entity=${job.entity}`} className="btn text-14">
            Import another file
          </Link>
        )}
        {bad > 0 && job.content && (
          <a href={`/admin/data-transfer/import/${id}/errors`} download className={`${textButton} self-center`}>
            ⭳ Download error report ({bad} rows)
          </a>
        )}
      </div>

      <div className={card}>
        <FilterChips
          items={[
            { label: `All (${reports.length})`, href: href("all"), active: show === "all" },
            { label: `Valid (${count("valid")})`, href: href("valid"), active: show === "valid" },
            { label: `Warnings (${count("warning")})`, href: href("warning"), active: show === "warning" },
            { label: `Errors (${count("error")})`, href: href("error"), active: show === "error" },
          ]}
        />
        {slice.length ? (
          <ol className="grid gap-1.5">
            {slice.map((r) => (
              <li key={r.line} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-[#f0f1f3] py-2 text-13 last:border-b-0">
                <span className="w-[62px] flex-none font-semibold text-muted">Row {r.line}</span>
                <span className={`rounded-pill px-2 py-0.5 text-12 font-bold ${levelStyle[r.level]}`}>
                  {r.outcome ? outcomeLabel[r.outcome] : r.level === "error" ? "Error" : r.level === "warning" ? "Warning" : "Valid"}
                </span>
                {!r.outcome && r.level !== "error" && <span className="text-12 text-muted">{actionLabel[r.action]}</span>}
                <span className="min-w-0 font-semibold break-all">{r.key}</span>
                {r.messages.length > 0 && <span className={`basis-full pl-[74px] max-sm:pl-0 ${r.level === "error" ? "text-accent" : "text-muted"}`}>{r.messages.join(" · ")}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-13 text-muted">No rows here.</p>
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil(shown.length / PER_PAGE))} total={shown.length} href={(p) => href(show, p)} />
      </div>
    </>
  );
}
