import { SettingsForm } from "@/components/admin/settings-form";
import { card, cardTitle } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { getStoreRules } from "@/lib/settings";

export default async function AdminSettings() {
  await requireAdminPage("/admin/settings");
  const rules = await getStoreRules();
  return (
    <div className={`${card} max-w-[640px]`}>
      <h3 className={cardTitle}>Store settings</h3>
      <SettingsForm rules={rules} />
      <p className="mt-3.5 text-13 text-muted">
        Changes apply to the storefront right away: cart and checkout totals, and the free-shipping line in the header. Existing orders keep the
        amounts they were placed with.
      </p>
    </div>
  );
}
