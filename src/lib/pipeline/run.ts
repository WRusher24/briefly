import { and, desc, eq, sql } from "drizzle-orm";
import { db, feeds, items, flashBriefings, refreshRuns, userSettings, type Feed, type RunStats } from "@/db";
import { DOMAINS, type Domain } from "@/lib/domains";
import { AiClient } from "@/lib/ai/client";
import { getAiConfig, getPreferences, getSettings } from "@/lib/settings";
import { pruneRateLimits } from "@/lib/rate-limit";
import { clusterItems } from "./cluster";
import { fetchFeed, hashUrl, type RawItem } from "./rss";
import { CANDIDATE_THRESHOLD, scoreItem } from "./relevance";
import { AbortRun, generateFlash, processDomain } from "./summarize";

export type RunTrigger = "manual" | "cron" | "lazy";

export interface RunOutcome {
  runId: string;
  status: "success" | "partial" | "failed";
  stats: RunStats;
  error?: string;
}

const emptyStats = (): RunStats => ({
  feedsFetched: 0,
  feedsFailed: 0,
  rawItems: 0,
  candidates: 0,
  processed: 0,
  rejected: 0,
  failed: 0,
  aiCalls: 0,
});

/** Inserts a "running" row unless a live run already exists for this user (atomic). */
async function acquireRun(userId: string, trigger: RunTrigger): Promise<string | null> {
  const rows = await db().execute<{ id: string }>(sql`
    insert into refresh_runs (user_id, trigger, status)
    select ${userId}::uuid, ${trigger}, 'running'
    where not exists (
      select 1 from refresh_runs
      where user_id = ${userId}::uuid and status = 'running' and started_at > now() - interval '10 minutes'
    )
    returning id
  `);
  return (rows as unknown as Array<{ id: string }>)[0]?.id ?? null;
}

async function mapPool<T, R>(list: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, list.length) }, async () => {
      while (next < list.length) {
        const index = next++;
        results[index] = await fn(list[index]);
      }
    }),
  );
  return results;
}

interface Scored {
  raw: RawItem;
  feed: Feed;
  score: number;
}

/**
 * Stage 1–3: fetch feeds, apply the deterministic relevance filter, de-duplicate and cluster,
 * and store the best fresh candidates as "pending" items.
 */
async function ingest(userId: string, stats: RunStats): Promise<void> {
  const settings = await getSettings(userId);
  const prefs = getPreferences(settings);
  const userFeeds = await db().select().from(feeds).where(and(eq(feeds.userId, userId), eq(feeds.enabled, true)));
  if (userFeeds.length === 0) return;

  const fetched = await mapPool(userFeeds, 8, async (feed) => ({ feed, result: await fetchFeed(feed.url, feed) }));

  const known = new Set(
    (
      await db()
        .select({ h: items.urlHash })
        .from(items)
        .where(and(eq(items.userId, userId), sql`${items.createdAt} > now() - interval '14 days'`))
    ).map((r) => r.h),
  );

  const now = new Date();
  const byDomain = new Map<Domain, Scored[]>();
  const seenInRun = new Set<string>();

  for (const { feed, result } of fetched) {
    const update: Partial<typeof feeds.$inferInsert> = { lastFetchedAt: now };
    if (result.status === "error") {
      stats.feedsFailed++;
      update.lastStatus = "error";
      update.lastError = result.error ?? "Unknown error";
    } else {
      stats.feedsFetched++;
      update.lastStatus = "ok";
      update.lastError = null;
      if (result.status === "ok") {
        update.etag = result.etag ?? null;
        update.lastModified = result.lastModified ?? null;
        update.lastItemCount = result.items.length;
      }
    }
    await db().update(feeds).set(update).where(eq(feeds.id, feed.id));

    stats.rawItems += result.items.length;
    for (const raw of result.items) {
      const hash = hashUrl(raw.url);
      if (known.has(hash) || seenInRun.has(`${feed.domain}:${hash}`)) continue;
      seenInRun.add(`${feed.domain}:${hash}`);
      const { score, reject } = scoreItem(raw, { domain: feed.domain, subtopic: feed.subtopic, prefs, now });
      if (reject || score < CANDIDATE_THRESHOLD) continue;
      const list = byDomain.get(feed.domain) ?? [];
      list.push({ raw, feed, score });
      byDomain.set(feed.domain, list);
    }
  }

  for (const domain of DOMAINS) {
    const scored = byDomain.get(domain) ?? [];
    if (scored.length === 0) continue;

    const clusters = clusterItems(scored.map((s) => ({ ...s, title: s.raw.title })));
    const ranked = clusters
      .map(({ primary, members }) => {
        const names = new Map<string, string>();
        for (const m of members) if (!names.has(m.feed.name)) names.set(m.feed.name, m.raw.url);
        // Several independent outlets covering the same story is itself a significance signal.
        const corroboration = Math.min(20, (names.size - 1) * 8);
        return {
          primary,
          score: Math.min(100, primary.score + corroboration),
          sources: [...names.entries()].map(([name, url]) => ({ name, url })),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, prefs.maxStoriesPerDomain + 2);

    stats.candidates += ranked.length;
    await db()
      .insert(items)
      .values(
        ranked.map(({ primary, score, sources }) => ({
          userId,
          feedId: primary.feed.id,
          domain,
          urlHash: hashUrl(primary.raw.url),
          url: primary.raw.url,
          sourceName: primary.feed.name.replace(/\s+[—-]\s+.*$/, ""),
          title: primary.raw.title,
          rawText: primary.raw.text,
          sources,
          publishedAt: primary.raw.publishedAt,
          relevance: score,
        })),
      )
      .onConflictDoNothing();
  }
}

async function needsFlash(userId: string, domain: Domain, producedNow: number): Promise<boolean> {
  if (producedNow > 0) return true;
  const [latest] = await db()
    .select({ at: flashBriefings.generatedAt })
    .from(flashBriefings)
    .where(and(eq(flashBriefings.userId, userId), eq(flashBriefings.domain, domain)))
    .orderBy(desc(flashBriefings.generatedAt))
    .limit(1);
  return !latest || Date.now() - latest.at.getTime() > 4 * 60 * 60 * 1000;
}

async function prune(userId: string): Promise<void> {
  await db().delete(items).where(and(eq(items.userId, userId), sql`${items.createdAt} < now() - interval '14 days'`));
  await db().delete(flashBriefings).where(and(eq(flashBriefings.userId, userId), sql`${flashBriefings.generatedAt} < now() - interval '30 days'`));
}

/**
 * Full pipeline for one user: ingest → filter → AI synthesis → flash briefings → housekeeping.
 * Returns null when another run for the same user is already in progress.
 */
export async function runRefreshForUser(
  userId: string,
  options: { trigger: RunTrigger; deadline?: number },
): Promise<RunOutcome | null> {
  const deadline = options.deadline ?? Date.now() + 240_000;
  const runId = await acquireRun(userId, options.trigger);
  if (!runId) return null;

  const stats = emptyStats();
  const errors: string[] = [];
  let status: RunOutcome["status"] = "success";

  try {
    const settings = await getSettings(userId);
    const config = getAiConfig(settings);
    if (!config) {
      errors.push("No usable AI API key is configured. Add one in Settings → AI.");
      status = "failed";
      return await finish(runId, userId, status, stats, errors, false);
    }
    const prefs = getPreferences(settings);
    const ai = new AiClient(config);

    await ingest(userId, stats);

    const produced = new Map<Domain, number>();
    const outcomes = await Promise.allSettled(
      DOMAINS.map(async (domain) => {
        produced.set(domain, await processDomain(ai, userId, domain, prefs, deadline, stats));
      }),
    );
    for (const o of outcomes) {
      if (o.status === "rejected") errors.push(o.reason instanceof AbortRun ? o.reason.message : String(o.reason?.message ?? o.reason));
    }

    for (const domain of DOMAINS) {
      if (Date.now() > deadline - 10_000) break;
      try {
        if (await needsFlash(userId, domain, produced.get(domain) ?? 0)) await generateFlash(ai, userId, domain);
      } catch (err) {
        errors.push(`Flash briefing (${domain}): ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    stats.aiCalls = ai.calls;

    await prune(userId);
    status = errors.length === 0 ? "success" : stats.processed > 0 ? "partial" : "failed";
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Unexpected error");
    status = "failed";
  }
  return finish(runId, userId, status, stats, errors, status !== "failed" || stats.processed > 0);
}

async function finish(
  runId: string,
  userId: string,
  status: RunOutcome["status"],
  stats: RunStats,
  errors: string[],
  touchLastRefresh: boolean,
): Promise<RunOutcome> {
  const error = errors.length ? [...new Set(errors)].join(" | ").slice(0, 1000) : undefined;
  await db().update(refreshRuns).set({ status, stats, error: error ?? null, finishedAt: new Date() }).where(eq(refreshRuns.id, runId));
  if (touchLastRefresh) await db().update(userSettings).set({ lastRefreshAt: new Date() }).where(eq(userSettings.userId, userId));
  return { runId, status, stats, error };
}

/** Cron entry point: refreshes every user whose briefing is older than ~4h, oldest first. */
export async function runDueRefreshes(budgetMs = 270_000): Promise<{ attempted: number; succeeded: number; skipped: number }> {
  const deadline = Date.now() + budgetMs;
  const due = await db()
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(
      and(
        sql`${userSettings.aiApiKeyEnc} is not null`,
        sql`(${userSettings.lastRefreshAt} is null or ${userSettings.lastRefreshAt} < now() - interval '3 hours 30 minutes')`,
      ),
    )
    .orderBy(sql`${userSettings.lastRefreshAt} asc nulls first`)
    .limit(200);

  let attempted = 0;
  let succeeded = 0;
  let skipped = 0;
  for (const { userId } of due) {
    if (Date.now() > deadline - 45_000) break;
    const outcome = await runRefreshForUser(userId, { trigger: "cron", deadline });
    if (!outcome) {
      skipped++;
      continue;
    }
    attempted++;
    if (outcome.status !== "failed") succeeded++;
  }
  await pruneRateLimits().catch(() => undefined);
  return { attempted, succeeded, skipped };
}

export async function isRefreshRunning(userId: string): Promise<boolean> {
  const rows = await db()
    .select({ id: refreshRuns.id })
    .from(refreshRuns)
    .where(and(eq(refreshRuns.userId, userId), eq(refreshRuns.status, "running"), sql`${refreshRuns.startedAt} > now() - interval '10 minutes'`))
    .limit(1);
  return rows.length > 0;
}

