// Data Transfer → Export download (Phase 15): export.access + the entity's export permission.
import { can } from "@/lib/acl";
import { getAdmin } from "@/lib/admin";
import { exportDownload } from "@/lib/data-transfer/download";
import { exporter } from "@/lib/data-transfer/registry";

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const admin = await getAdmin("export.access");
  const adapter = exporter(entity);
  if (!admin || !adapter || !can(admin, adapter.permission)) return new Response("Not found", { status: 404 });
  return exportDownload(adapter, new URL(request.url).searchParams, admin);
}
