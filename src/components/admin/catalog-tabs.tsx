import { AdminTabs } from "@/components/admin/admin-tabs";
import { getAdmin } from "@/lib/admin";
import { allowedTabs, CATALOG_TABS, DATA_TRANSFER_TABS, SYSTEM_TABS } from "@/lib/admin-sections";

// Tabs across the catalog screens (under the sidebar's "Products"), only those the admin may open.
export async function CatalogTabs() {
  const admin = await getAdmin();
  if (!admin) return null;
  return <AdminTabs label="Catalog" tabs={allowedTabs(admin, CATALOG_TABS).map(({ href, label }) => ({ href, label }))} />;
}

// Tabs across Admin users / Roles / Activity log (sidebar "System").
export async function SystemTabs() {
  const admin = await getAdmin();
  if (!admin) return null;
  return <AdminTabs label="System" tabs={allowedTabs(admin, SYSTEM_TABS).map(({ href, label }) => ({ href, label }))} />;
}

// Tabs across Data Transfer → Import / Export.
export async function DataTransferTabs() {
  const admin = await getAdmin();
  if (!admin) return null;
  return <AdminTabs label="Data transfer" tabs={allowedTabs(admin, DATA_TRANSFER_TABS).map(({ href, label }) => ({ href, label }))} />;
}
