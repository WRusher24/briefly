import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, items } from "@/db";
import { route } from "@/lib/api";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

/** Marks cards that were viewed and scrolled away. They never appear in the feed again. */
export const POST = route({ body: schema }, async ({ user, body }) => {
  await db()
    .update(items)
    .set({ seenAt: new Date() })
    .where(and(eq(items.userId, user.id), inArray(items.id, body.ids), isNull(items.seenAt)));
  return { ok: true };
});
