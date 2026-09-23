import { SettingsTabs } from "@/components/admin/settings-tabs";

// Settings → tabs (Phase 11). Each tab page checks the admin role itself.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[900px]">
      <SettingsTabs />
      {children}
    </div>
  );
}
