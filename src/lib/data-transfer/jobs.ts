// Import jobs (Phase 15): the validated upload is stored, previewed, then imported once when confirmed.
// Every function checks the actor's permissions itself (import.access + the entity's import permission).
import type { Prisma } from "@/generated/prisma/client";
import { can, type AdminAccess } from "@/lib/acl";
import { audit } from "@/lib/audit";
import { errorReportCsv, runImport, validateCsv, type RowReport, type Totals } from "@/lib/data-transfer/import-engine";
import { importer } from "@/lib/data-transfer/registry";
import { BEHAVIORS, type Behavior, type OnError } from "@/lib/data-transfer/types";
import { db } from "@/lib/db";

export type Actor = AdminAccess & { email: string };

/** Uploads are kept this long, then only the summary stays. */
const KEEP_DAYS = 7;

const mayImport = (actor: Actor, entity: string) => {
  const a = importer(entity);
  return a && can(actor, "import.access") && can(actor, a.permission) ? a : null;
};

export async function purgeOldUploads() {
  const before = new Date(Date.now() - KEEP_DAYS * 86_400_000);
  await db.importJob.updateMany({ where: { createdAt: { lt: before }, content: { not: null } }, data: { content: null } });
  // Previews nobody confirmed are cancelled after a day.
  await db.importJob.updateMany({ where: { status: "VALIDATED", createdAt: { lt: new Date(Date.now() - 86_400_000) } }, data: { status: "CANCELLED", content: null } });
}

export async function createJob(
  actor: Actor,
  input: { entity: string; behavior: string; onError: string; file: { text: string; name: string; size: number } },
): Promise<{ id: string } | { error: string }> {
  const adapter = mayImport(actor, input.entity);
  if (!adapter) return { error: "You don't have permission to import this." };
  if (!Object.hasOwn(BEHAVIORS, input.behavior) || !adapter.behaviors.includes(input.behavior as Behavior)) return { error: "Choose an import behavior." };
  const onError: OnError = input.onError === "stop" ? "stop" : "skip";
  await purgeOldUploads();

  const v = await validateCsv(adapter, input.file.text, input.behavior as Behavior);
  if (v.fileErrors.length) return { error: v.fileErrors.join(" ") };
  const job = await db.importJob.create({
    data: {
      entity: adapter.entity,
      behavior: input.behavior,
      onError,
      fileName: input.file.name,
      fileSize: input.file.size,
      content: input.file.text,
      totals: v.totals as unknown as Prisma.InputJsonValue,
      rows: { fileWarnings: v.fileWarnings, reports: v.reports } as unknown as Prisma.InputJsonValue,
      createdById: actor.id,
      createdByEmail: actor.email,
    },
    select: { id: true },
  });
  return job;
}

export type JobRows = { fileWarnings: string[]; reports: RowReport[] };

export async function getJob(actor: Actor, id: string) {
  const job = await db.importJob.findUnique({ where: { id } });
  if (!job || !mayImport(actor, job.entity)) return null;
  return { ...job, totals: job.totals as unknown as Totals, rows: job.rows as unknown as JobRows };
}

/** Runs the import once: VALIDATED → IMPORTING is claimed atomically, so a double click can't import twice. */
export async function commitJob(actor: Actor, id: string): Promise<{ ok: string } | { error: string }> {
  const job = await db.importJob.findUnique({ where: { id } });
  const adapter = job && mayImport(actor, job.entity);
  if (!job || !adapter) return { error: "Import not found." };
  if (!job.content) return { error: "This upload has expired; upload the file again." };
  const claimed = await db.importJob.updateMany({ where: { id, status: "VALIDATED" }, data: { status: "IMPORTING" } });
  if (claimed.count !== 1) return { error: "This import was already run or cancelled." };

  try {
    const { validation, result, stopped } = await runImport(adapter, job.content, job.behavior as Behavior, job.onError as OnError);
    await db.importJob.update({
      where: { id },
      data: {
        status: stopped || (result.failed > 0 && result.created + result.updated === 0) ? "FAILED" : "DONE",
        totals: validation.totals as unknown as Prisma.InputJsonValue,
        rows: { fileWarnings: [...validation.fileWarnings, ...(stopped ? [stopped] : [])], reports: validation.reports } as unknown as Prisma.InputJsonValue,
        result: result as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
    await audit({
      actor: { id: actor.id, email: actor.email },
      action: "data.imported",
      targetType: "data_transfer",
      targetId: id,
      targetLabel: `${adapter.label}: ${job.fileName}`,
      details: { behavior: job.behavior, onError: job.onError, ...result, ...(stopped && { stopped }) },
    });
    return { ok: stopped ?? `Imported: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.` };
  } catch (e) {
    console.error("[import] job failed", e);
    await db.importJob.update({ where: { id }, data: { status: "FAILED", finishedAt: new Date() } });
    return { error: "The import stopped because of an unexpected error. Rows already written are complete; see the result for details." };
  }
}

export async function cancelJob(actor: Actor, id: string) {
  const job = await db.importJob.findUnique({ where: { id }, select: { entity: true } });
  if (!job || !mayImport(actor, job.entity)) return false;
  const res = await db.importJob.updateMany({ where: { id, status: "VALIDATED" }, data: { status: "CANCELLED", content: null } });
  return res.count === 1;
}

export async function jobErrorReport(actor: Actor, id: string) {
  const job = await getJob(actor, id);
  if (!job?.content) return null;
  return { name: job.fileName.replace(/\.csv$/i, ""), csv: errorReportCsv(job.content, job.rows.reports) };
}
