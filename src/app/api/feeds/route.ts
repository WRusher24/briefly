import { asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, feeds } from "@/db";
import { HttpError, route } from "@/lib/api";
import { DOMAINS } from "@/lib/domains";
import { assertPublicUrl } from "@/lib/net";
import { fetchFeed } from "@/lib/pipeline/rss";

export const maxDuration = 30;
const MAX_FEEDS = 120;

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  url: z.string().trim().url("Enter a valid feed URL").max(500),
  domain: z.enum(DOMAINS),
  subtopic: z.string().trim().max(40).optional(),
});

export const GET = route({}, async ({ user }) => {
  const rows = await db().select().from(feeds).where(eq(feeds.userId, user.id)).orderBy(asc(feeds.domain), asc(feeds.subtopic), asc(feeds.name));
  return rows.map(({ etag, lastModified, userId, ...rest }) => rest);
});

export const POST = route({ body: createSchema }, async ({ user, body }) => {
  const [{ total }] = await db().select({ total: count() }).from(feeds).where(eq(feeds.userId, user.id));
  if (total >= MAX_FEEDS) throw new HttpError(400, `You can have at most ${MAX_FEEDS} feeds`);

  await assertPublicUrl(body.url);
  const probe = await fetchFeed(body.url);
  if (probe.status === "error") throw new HttpError(422, `That URL isn't a readable RSS/Atom feed (${probe.error})`);

  const [created] = await db()
    .insert(feeds)
    .values({
      userId: user.id,
      name: body.name,
      url: body.url,
      domain: body.domain,
      subtopic: body.subtopic || "Custom",
      lastStatus: "ok",
      lastFetchedAt: new Date(),
      lastItemCount: probe.items.length,
    })
    .onConflictDoNothing()
    .returning();
  if (!created) throw new HttpError(409, "You already have a feed with this URL");
  const { etag, lastModified, userId, ...rest } = created;
  return rest;
});
