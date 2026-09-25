// "Download sample CSV" (Phase 15): headers, required/optional columns filled with example values.
import { can } from "@/lib/acl";
import { getAdmin } from "@/lib/admin";
import { csvResponse } from "@/lib/csv";
import { importer, sampleRows } from "@/lib/data-transfer/registry";

export async function GET(_: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const admin = await getAdmin("import.access");
  const adapter = importer(entity);
  if (!admin || !adapter || !can(admin, adapter.permission)) return new Response("Not found", { status: 404 });
  return csvResponse(`${adapter.entity}-sample.csv`, sampleRows(adapter));
}
