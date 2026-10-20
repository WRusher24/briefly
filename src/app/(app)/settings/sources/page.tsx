import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { SourcesManager } from "@/components/sources-manager";
import { db, feeds } from "@/db";
import { requirePageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sources" };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const user = await requirePageUser();
  const rows = await db().select().from(feeds).where(eq(feeds.userId, user.id)).orderBy(asc(feeds.subtopic), asc(feeds.name));
  return (
    <SourcesManager
      initial={rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        subtopic: r.subtopic,
        name: r.name,
        url: r.url,
        enabled: r.enabled,
        isDefault: r.isDefault,
        lastStatus: r.lastStatus,
        lastError: r.lastError,
        lastFetchedAt: r.lastFetchedAt?.toISOString() ?? null,
        lastItemCount: r.lastItemCount,
      }))}
    />
  );
}
