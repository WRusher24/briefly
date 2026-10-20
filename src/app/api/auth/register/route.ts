import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, users, userSettings } from "@/db";
import { createSession, hashPassword } from "@/lib/auth";
import { HttpError, route } from "@/lib/api";
import { seedDefaultFeeds } from "@/lib/feeds";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(10, "Password must be at least 10 characters").max(72, "Password must be at most 72 characters"),
});

export const POST = route({ auth: false, body: schema }, async ({ req, body }) => {
  if (!(await rateLimit(`register:${clientIp(req as NextRequest)}`, 8, 3600))) {
    throw new HttpError(429, "Too many sign-up attempts. Please try again later.");
  }
  const passwordHash = await hashPassword(body.password);
  let user;
  try {
    [user] = await db().insert(users).values({ name: body.name, email: body.email, passwordHash }).returning();
  } catch (err) {
    if (/users_email_idx|duplicate key/i.test(String((err as Error).message) + String((err as { cause?: Error }).cause?.message))) {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw err;
  }
  await db().insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
  await seedDefaultFeeds(user.id);
  await createSession(user);
  return { ok: true };
});
