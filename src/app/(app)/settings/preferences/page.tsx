import type { Metadata } from "next";
import { PreferencesForm } from "@/components/preferences-form";
import { requirePageUser } from "@/lib/auth";
import { getPreferences, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Preferences" };
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const user = await requirePageUser();
  const settings = await getSettings(user.id);
  return <PreferencesForm initial={getPreferences(settings)} name={user.name} email={user.email} />;
}
