// Error report of an import (Phase 15): the rows with errors, with their row number and messages.
import { getAdmin } from "@/lib/admin";
import { jobErrorReport } from "@/lib/data-transfer/jobs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdmin("import.access");
  const report = admin && (await jobErrorReport(admin, id));
  if (!report) return new Response("Not found", { status: 404 });
  return new Response("﻿" + report.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.name}-errors.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
