import { SettingsTabs } from "@/components/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsTabs />
      <div className="pt-5">{children}</div>
    </>
  );
}
