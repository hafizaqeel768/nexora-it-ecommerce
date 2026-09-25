import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin";
import { allowedTabs, DATA_TRANSFER_TABS } from "@/lib/admin-sections";

// Data Transfer: opens Import or Export, whichever the admin may use.
export default async function DataTransfer() {
  const admin = await requireAdminPage("/admin/data-transfer", ["import.access", "export.access"]);
  redirect(allowedTabs(admin, DATA_TRANSFER_TABS)[0]?.href ?? "/admin/forbidden");
}
