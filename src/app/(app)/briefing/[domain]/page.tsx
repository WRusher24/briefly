import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BriefingView } from "@/components/briefing-view";
import { HubTabs } from "@/components/nav";
import { requirePageUser } from "@/lib/auth";
import { DOMAIN_META, isDomain } from "@/lib/domains";
import { runRefreshForUser } from "@/lib/pipeline/run";
import { getBriefingItems, getLatestFlash, getRefreshState, shouldLazyRefresh } from "@/lib/queries";
import { getAiConfig, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const { domain } = await params;
  return { title: isDomain(domain) ? DOMAIN_META[domain].short : "Briefing" };
}

export default async function BriefingPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  if (!isDomain(domain)) notFound();
  const user = await requirePageUser();
  const settings = await getSettings(user.id);
  const hasKey = !!getAiConfig(settings);

  // Opportunistic refresh: if the 4-hourly job hasn't reached this user yet, update in the background.
  const lazy = await shouldLazyRefresh(user.id, settings.lastRefreshAt, hasKey);
  if (lazy) {
    after(async () => {
      await runRefreshForUser(user.id, { trigger: "lazy", deadline: Date.now() + 270_000 }).catch((err) =>
        console.error("[refresh] lazy run crashed", err),
      );
    });
  }

  const [items, flash, refresh] = await Promise.all([
    getBriefingItems(user.id, domain),
    getLatestFlash(user.id, domain),
    getRefreshState(user.id, settings.lastRefreshAt),
  ]);
  const initialRefresh = lazy ? { ...refresh, running: true } : refresh;

  return (
    <>
      <HubTabs active={domain} />
      <BriefingView key={domain} domain={domain} hasKey={hasKey} initialItems={items} initialFlash={flash} initialRefresh={initialRefresh} />
    </>
  );
}
