// "Export CSV" links on the Products, Orders and Customers lists. Since Phase 15 they use the Data Transfer
// export (same columns as Data Transfer → Export, so a product export can be imported again). The lists'
// filters (?q, ?cat, ?status) are the same filter names. Needs only the entity's export permission.
import { can } from "@/lib/acl";
import { getAdmin } from "@/lib/admin";
import { exportDownload } from "@/lib/data-transfer/download";
import { exporter } from "@/lib/data-transfer/registry";

const KINDS = ["products", "orders", "customers"];

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const adapter = KINDS.includes(kind) ? exporter(kind) : null;
  const admin = await getAdmin();
  if (!adapter || !admin || !can(admin, adapter.permission)) return new Response("Not found", { status: 404 });
  return exportDownload(adapter, new URL(request.url).searchParams, admin);
}
