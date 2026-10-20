import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, items, flashBriefings, type Item, type InsightPayload, type RunStats } from "@/db";
import type { Domain } from "@/lib/domains";
import type { Preferences } from "@/lib/preferences";
import { AiError, type AiClient } from "@/lib/ai/client";
import { ANALYST_SYSTEM, batchPrompt, flashPrompt } from "@/lib/ai/prompts";
import { estimateReadSeconds } from "@/lib/readtime";
import { fetchArticleText } from "./article";

const BATCH_SIZE = 4;
const MAX_ATTEMPTS = 3;
const MIN_IMPORTANCE = 4;
const THIN_TEXT = 500;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

const verdictSchema = z.object({
  id: z.coerce.string(),
  relevant: z.boolean().optional().default(true),
  importance: z.coerce.number().min(1).max(10).optional().default(5),
  headline: z.string().optional(),
  tldr: z.string().optional(),
  facts: z.array(z.string()).optional(),
  why: z.string().optional(),
  angle: z.string().optional(),
});

const responseSchema = z.object({ items: z.array(z.unknown()) });

export class AbortRun extends Error {}

interface Verdict {
  relevant: boolean;
  importance: number;
  insight?: InsightPayload;
}

function toVerdict(raw: unknown): { id: string; verdict: Verdict } | null {
  const parsed = verdictSchema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  if (!v.relevant) return { id: v.id, verdict: { relevant: false, importance: v.importance } };

  const facts = (v.facts ?? []).map(clean).filter(Boolean).slice(0, 3);
  const headline = clean(v.headline ?? "");
  const tldr = clean(v.tldr ?? "");
  const why = clean(v.why ?? "");
  const angle = clean(v.angle ?? "");
  if (!headline || !tldr || facts.length === 0 || !why || !angle) return null;
  return { id: v.id, verdict: { relevant: true, importance: v.importance, insight: { headline: headline.slice(0, 160), tldr, facts, why, angle } } };
}

async function enrich(batch: Item[]): Promise<void> {
  await Promise.all(
    batch.map(async (item) => {
      if (item.rawText.length >= THIN_TEXT) return;
      const full = await fetchArticleText(item.url);
      if (full.length > item.rawText.length) {
        item.rawText = full;
        await db().update(items).set({ rawText: full }).where(eq(items.id, item.id));
      }
    }),
  );
}

/**
 * Summarises pending items for one domain in small batches. Each batch is persisted
 * immediately, so a timeout never loses completed work.
 */
export async function processDomain(
  ai: AiClient,
  userId: string,
  domain: Domain,
  prefs: Preferences,
  deadline: number,
  stats: RunStats,
): Promise<number> {
  const pending = await db()
    .select()
    .from(items)
    .where(and(eq(items.userId, userId), eq(items.domain, domain), eq(items.status, "pending")))
    .orderBy(desc(items.relevance), asc(items.createdAt))
    .limit(prefs.maxStoriesPerDomain + 4);

  let produced = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    if (Date.now() > deadline - 20_000) break;
    const batch = pending.slice(i, i + BATCH_SIZE);
    await enrich(batch);

    const payload = batch.map((item, n) => ({
      id: String(n + 1),
      source: item.sourceName,
      published: item.publishedAt.toISOString(),
      title: item.title,
      text: item.rawText.slice(0, 1800) || "(no body text available — rely on the title only and keep facts minimal)",
      also_reported_by: item.sources.length > 1 ? item.sources.slice(1, 4).map((s) => s.name) : undefined,
    }));

    let verdicts = new Map<string, Verdict>();
    try {
      const reply = await ai.completeJson(
        [
          { role: "system", content: ANALYST_SYSTEM },
          { role: "user", content: batchPrompt(domain, prefs, payload) },
        ],
        { maxTokens: 3000 },
      );
      const parsed = responseSchema.safeParse(reply);
      if (parsed.success) {
        for (const raw of parsed.data.items) {
          const v = toVerdict(raw);
          if (v) verdicts.set(v.id, v.verdict);
        }
      }
    } catch (err) {
      if (err instanceof AiError && !err.retryable && err.status && [400, 401, 403, 404].includes(err.status)) {
        throw new AbortRun(err.message);
      }
      // Transient failure (rate limit / outage): count the attempt, stop this domain, retry next run.
      await bumpAttempts(batch.map((b) => b.id));
      stats.aiCalls = ai.calls;
      throw new AbortRun(err instanceof Error ? err.message : "AI request failed");
    }

    for (let n = 0; n < batch.length; n++) {
      const item = batch[n];
      const verdict = verdicts.get(String(n + 1));
      if (!verdict) {
        const attempts = item.attempts + 1;
        await db()
          .update(items)
          .set({ attempts, status: attempts >= MAX_ATTEMPTS ? "failed" : "pending" })
          .where(eq(items.id, item.id));
        if (attempts >= MAX_ATTEMPTS) stats.failed++;
        continue;
      }
      if (!verdict.relevant || !verdict.insight || verdict.importance < MIN_IMPORTANCE) {
        await db().update(items).set({ status: "rejected", importance: verdict.importance }).where(eq(items.id, item.id));
        stats.rejected++;
        continue;
      }
      const { headline, tldr, facts, why, angle } = verdict.insight;
      await db()
        .update(items)
        .set({
          status: "ready",
          importance: verdict.importance,
          insight: verdict.insight,
          readSeconds: estimateReadSeconds(headline, tldr, facts.join(" "), why, angle),
        })
        .where(eq(items.id, item.id));
      stats.processed++;
      produced++;
    }
    stats.aiCalls = ai.calls;
  }
  return produced;
}

async function bumpAttempts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db()
    .update(items)
    .set({
      attempts: sql`${items.attempts} + 1`,
      status: sql`case when ${items.attempts} + 1 >= ${MAX_ATTEMPTS} then 'failed'::item_status else 'pending'::item_status end`,
    })
    .where(inArray(items.id, ids));
}

const flashSchema = z.object({ bullets: z.array(z.string()).min(1) });

/** Generates the 3-bullet executive flash briefing from the strongest recent stories. */
export async function generateFlash(ai: AiClient, userId: string, domain: Domain): Promise<boolean> {
  const rows = await db()
    .select({ insight: items.insight, importance: items.importance })
    .from(items)
    .where(
      and(
        eq(items.userId, userId),
        eq(items.domain, domain),
        eq(items.status, "ready"),
        sql`${items.publishedAt} > now() - interval '30 hours'`,
      ),
    )
    .orderBy(desc(items.importance))
    .limit(8);

  const stories = rows.flatMap((r) => (r.insight ? [{ headline: r.insight.headline, tldr: r.insight.tldr }] : []));
  if (stories.length < 2) return false;

  const reply = await ai.completeJson(
    [
      { role: "system", content: ANALYST_SYSTEM },
      { role: "user", content: flashPrompt(domain, stories) },
    ],
    { maxTokens: 600 },
  );
  const parsed = flashSchema.safeParse(reply);
  if (!parsed.success) return false;
  const bullets = parsed.data.bullets.map(clean).filter(Boolean).slice(0, 3);
  if (bullets.length === 0) return false;

  await db().insert(flashBriefings).values({ userId, domain, bullets, generatedAt: new Date() });
  return true;
}
