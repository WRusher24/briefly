import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { HttpError, route } from "@/lib/api";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(10, "New password must be at least 10 characters").max(72),
});

/** Changes the password and revokes every other session by bumping the token version. */
export const PUT = route({ body: schema }, async ({ user, body }) => {
  if (!(await rateLimit(`pw:${user.id}`, 10, 900))) throw new HttpError(429, "Too many attempts. Try again later.");
  if (!(await verifyPassword(body.current, user.passwordHash))) throw new HttpError(400, "Current password is incorrect");
  const [updated] = await db()
    .update(users)
    .set({ passwordHash: await hashPassword(body.next), tokenVersion: user.tokenVersion + 1 })
    .where(eq(users.id, user.id))
    .returning();
  await createSession(updated);
  return { ok: true };
});
