import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, feeds } from "@/db";
import { HttpError, route } from "@/lib/api";
import { DOMAINS } from "@/lib/domains";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  domain: z.enum(DOMAINS).optional(),
  subtopic: z.string().trim().min(1).max(40).optional(),
});

const idSchema = z.string().uuid();

export const PATCH = route<{ id: string }, typeof patchSchema>({ body: patchSchema }, async ({ user, params, body }) => {
  if (!idSchema.safeParse(params.id).success) throw new HttpError(404, "Feed not found");
  const updated = await db()
    .update(feeds)
    .set(body)
    .where(and(eq(feeds.id, params.id), eq(feeds.userId, user.id)))
    .returning({ id: feeds.id });
  if (updated.length === 0) throw new HttpError(404, "Feed not found");
  return { ok: true };
});

export const DELETE = route<{ id: string }>({}, async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw new HttpError(404, "Feed not found");
  const removed = await db()
    .delete(feeds)
    .where(and(eq(feeds.id, params.id), eq(feeds.userId, user.id)))
    .returning({ id: feeds.id });
  if (removed.length === 0) throw new HttpError(404, "Feed not found");
  return { ok: true };
});
