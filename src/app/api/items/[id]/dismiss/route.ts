import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, items } from "@/db";
import { HttpError, route } from "@/lib/api";

export const POST = route<{ id: string }>({}, async ({ user, params }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw new HttpError(404, "Not found");
  const updated = await db()
    .update(items)
    .set({ dismissedAt: new Date(), seenAt: new Date() })
    .where(and(eq(items.id, params.id), eq(items.userId, user.id)))
    .returning({ id: items.id });
  if (updated.length === 0) throw new HttpError(404, "Not found");
  return { ok: true };
});
