import type { Metadata } from "next";
import { AiSettingsForm } from "@/components/ai-settings-form";
import { requirePageUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "AI settings" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requirePageUser();
  const s = await getSettings(user.id);
  const { welcome } = await searchParams;
  return (
    <AiSettingsForm
      welcome={welcome === "1"}
      initial={{ provider: s.aiProvider, baseUrl: s.aiBaseUrl, model: s.aiModel, hasKey: !!s.aiApiKeyEnc, keyLast4: s.aiKeyLast4 }}
    />
  );
}
