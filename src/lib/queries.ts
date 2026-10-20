import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, flashBriefings, items, refreshRuns, savedDebriefs, type InsightPayload, type SourceRef } from "@/db";
import type { Domain } from "./domains";
import { REFRESH_INTERVAL_MS } from "./time";

export interface CardItem {
  id: string;
  domain: Domain;
  sourceName: string;
  url: string;
  publishedAt: string;
  readSeconds: number;
  importance: number;
  insight: InsightPayload;
  sources: SourceRef[];
  savedId: string | null;
}

export interface FlashData {
  id: string;
  bullets: string[];
  generatedAt: string;
  savedId: string | null;
}

export interface RefreshState {
  running: boolean;
  lastRefreshAt: string | null;
  lastRun: { status: string; error: string | null; finishedAt: string | null; processed: number } | null;
}

const FEED_LIMIT = 40;

/** Unseen, undismissed, ready stories for one domain, most significant & freshest first. */
export async function getBriefingItems(userId: string, domain: Domain): Promise<CardItem[]> {
  const rows = await db()
    .select({ item: items, savedId: savedDebriefs.id })
    .from(items)
    .leftJoin(savedDebriefs, and(eq(savedDebriefs.itemId, items.id), eq(savedDebriefs.userId, items.userId)))
    .where(
      and(
        eq(items.userId, userId),
        eq(items.domain, domain),
        eq(items.status, "ready"),
        isNull(items.dismissedAt),
        isNull(items.seenAt),
        sql`${items.createdAt} > now() - interval '72 hours'`,
      ),
    )
    .orderBy(desc(items.createdAt))
    .limit(120);

  const now = Date.now();
  return rows
    .filter((r) => r.item.insight)
    .map(({ item, savedId }) => {
      const ageHours = (now - item.publishedAt.getTime()) / 3_600_000;
      return {
        rank: (item.importance ?? 5) * 10 - ageHours * 0.8,
        card: {
          id: item.id,
          domain: item.domain,
          sourceName: item.sourceName,
          url: item.url,
          publishedAt: item.publishedAt.toISOString(),
          readSeconds: item.readSeconds ?? 30,
          importance: item.importance ?? 5,
          insight: item.insight as InsightPayload,
          sources: item.sources,
          savedId,
        } satisfies CardItem,
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, FEED_LIMIT)
    .map((r) => r.card);
}

export async function getLatestFlash(userId: string, domain: Domain): Promise<FlashData | null> {
  const [row] = await db()
    .select()
    .from(flashBriefings)
    .where(and(eq(flashBriefings.userId, userId), eq(flashBriefings.domain, domain)))
    .orderBy(desc(flashBriefings.generatedAt))
    .limit(1);
  if (!row) return null;

  const [saved] = await db()
    .select({ id: savedDebriefs.id })
    .from(savedDebriefs)
    .where(and(eq(savedDebriefs.userId, userId), eq(savedDebriefs.kind, "trend"), eq(savedDebriefs.eventAt, row.generatedAt), eq(savedDebriefs.domain, domain)))
    .limit(1);

  return { id: row.id, bullets: row.bullets, generatedAt: row.generatedAt.toISOString(), savedId: saved?.id ?? null };
}

export async function getRefreshState(userId: string, lastRefreshAt: Date | null): Promise<RefreshState> {
  const [run] = await db()
    .select()
    .from(refreshRuns)
    .where(eq(refreshRuns.userId, userId))
    .orderBy(desc(refreshRuns.startedAt))
    .limit(1);

  const running = !!run && run.status === "running" && Date.now() - run.startedAt.getTime() < 10 * 60_000;
  const [last] = await db()
    .select()
    .from(refreshRuns)
    .where(and(eq(refreshRuns.userId, userId), sql`${refreshRuns.status} <> 'running'`))
    .orderBy(desc(refreshRuns.startedAt))
    .limit(1);

  return {
    running,
    lastRefreshAt: lastRefreshAt?.toISOString() ?? null,
    lastRun: last
      ? { status: last.status, error: last.error, finishedAt: last.finishedAt?.toISOString() ?? null, processed: last.stats?.processed ?? 0 }
      : null,
  };
}

/** True when the briefing is stale and we have not already tried very recently. */
export async function shouldLazyRefresh(userId: string, lastRefreshAt: Date | null, hasKey: boolean): Promise<boolean> {
  if (!hasKey) return false;
  if (lastRefreshAt && Date.now() - lastRefreshAt.getTime() < REFRESH_INTERVAL_MS) return false;
  const [recent] = await db()
    .select({ id: refreshRuns.id })
    .from(refreshRuns)
    .where(and(eq(refreshRuns.userId, userId), sql`${refreshRuns.startedAt} > now() - interval '30 minutes'`))
    .limit(1);
  return !recent;
}
