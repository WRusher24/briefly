import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, savedDebriefs } from "@/db";
import { HttpError, route } from "@/lib/api";

const patchSchema = z.object({ note: z.string().max(2000) });
const idSchema = z.string().uuid();

export const PATCH = route<{ id: string }, typeof patchSchema>({ body: patchSchema }, async ({ user, params, body }) => {
  if (!idSchema.safeParse(params.id).success) throw new HttpError(404, "Not found");
  const updated = await db()
    .update(savedDebriefs)
    .set({ note: body.note.trim() })
    .where(and(eq(savedDebriefs.id, params.id), eq(savedDebriefs.userId, user.id)))
    .returning({ id: savedDebriefs.id });
  if (updated.length === 0) throw new HttpError(404, "Not found");
  return { ok: true };
});

export const DELETE = route<{ id: string }>({}, async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw new HttpError(404, "Not found");
  await db().delete(savedDebriefs).where(and(eq(savedDebriefs.id, params.id), eq(savedDebriefs.userId, user.id)));
  return { ok: true };
});
