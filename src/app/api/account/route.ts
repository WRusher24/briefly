import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { HttpError, route } from "@/lib/api";
import { destroySession, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1).max(200) });

/** Permanently deletes the account and (via ON DELETE CASCADE) every row the user owns. */
export const DELETE = route({ body: schema }, async ({ user, body }) => {
  if (!(await rateLimit(`delete:${user.id}`, 5, 900))) throw new HttpError(429, "Too many attempts. Try again later.");
  if (!(await verifyPassword(body.password, user.passwordHash))) throw new HttpError(400, "Password is incorrect");
  await db().delete(users).where(eq(users.id, user.id));
  await destroySession();
  return { ok: true };
});
