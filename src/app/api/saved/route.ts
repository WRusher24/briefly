import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, flashBriefings, items, savedDebriefs } from "@/db";
import { HttpError, route } from "@/lib/api";
import { DOMAIN_META, DOMAINS } from "@/lib/domains";

const saveSchema = z.union([
  z.object({ itemId: z.string().uuid() }),
  z.object({ flashId: z.string().uuid() }),
]);

export const GET = route({}, async ({ user, req }) => {
  const sp = req.nextUrl.searchParams;
  const domain = z.enum(DOMAINS).safeParse(sp.get("domain"));
  const kind = z.enum(["story", "trend"]).safeParse(sp.get("kind"));
  const q = sp.get("q")?.trim().slice(0, 100);

  const filters = [eq(savedDebriefs.userId, user.id)];
  if (domain.success) filters.push(eq(savedDebriefs.domain, domain.data));
  if (kind.success) filters.push(eq(savedDebriefs.kind, kind.data));
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(savedDebriefs.title, like), ilike(savedDebriefs.tldr, like), ilike(savedDebriefs.note, like))!);
  }
  return db().select().from(savedDebriefs).where(and(...filters)).orderBy(desc(savedDebriefs.savedAt)).limit(500);
});

/** Saves a story debrief (itemId) or an executive flash briefing / macro trend (flashId) as a permanent snapshot. */
export const POST = route({ body: saveSchema }, async ({ user, body }) => {
  if ("itemId" in body) {
    const [item] = await db()
      .select()
      .from(items)
      .where(and(eq(items.id, body.itemId), eq(items.userId, user.id)))
      .limit(1);
    if (!item?.insight) throw new HttpError(404, "Story not found");

    const [existing] = await db()
      .select({ id: savedDebriefs.id })
      .from(savedDebriefs)
      .where(and(eq(savedDebriefs.userId, user.id), eq(savedDebriefs.itemId, item.id)))
      .limit(1);
    if (existing) return { id: existing.id };

    const [row] = await db()
      .insert(savedDebriefs)
      .values({
        userId: user.id,
        itemId: item.id,
        kind: "story",
        domain: item.domain,
        title: item.insight.headline,
        tldr: item.insight.tldr,
        facts: item.insight.facts,
        why: item.insight.why,
        angle: item.insight.angle,
        sources: item.sources.length ? item.sources : [{ name: item.sourceName, url: item.url }],
        eventAt: item.publishedAt,
      })
      .returning({ id: savedDebriefs.id });
    return { id: row.id };
  }

  const [flash] = await db()
    .select()
    .from(flashBriefings)
    .where(and(eq(flashBriefings.id, body.flashId), eq(flashBriefings.userId, user.id)))
    .limit(1);
  if (!flash) throw new HttpError(404, "Briefing not found");

  const [existing] = await db()
    .select({ id: savedDebriefs.id })
    .from(savedDebriefs)
    .where(and(eq(savedDebriefs.userId, user.id), eq(savedDebriefs.kind, "trend"), eq(savedDebriefs.domain, flash.domain), eq(savedDebriefs.eventAt, flash.generatedAt)))
    .limit(1);
  if (existing) return { id: existing.id };

  const when = flash.generatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const [row] = await db()
    .insert(savedDebriefs)
    .values({
      userId: user.id,
      kind: "trend",
      domain: flash.domain,
      title: `${DOMAIN_META[flash.domain].short} Flash Briefing — ${when}`,
      tldr: flash.bullets[0] ?? "",
      facts: flash.bullets,
      eventAt: flash.generatedAt,
    })
    .returning({ id: savedDebriefs.id });
  return { id: row.id };
});
