import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { HttpError, route } from "@/lib/api";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

// Compared against when the email is unknown so response time doesn't reveal account existence.
const DUMMY_HASH = "$2a$11$CwTycUXWue0Thq9StjUM0uJ8.bJ6bQnH9bV6W1c0FqQ2J1jQ6s2yK";

export const POST = route({ auth: false, body: schema }, async ({ req, body }) => {
  const ip = clientIp(req as NextRequest);
  const allowed = (await rateLimit(`login:ip:${ip}`, 30, 900)) && (await rateLimit(`login:email:${body.email}`, 10, 900));
  if (!allowed) throw new HttpError(429, "Too many login attempts. Please wait a few minutes and try again.");

  const [user] = await db().select().from(users).where(sql`lower(${users.email}) = ${body.email}`).limit(1);
  const valid = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, "Incorrect email or password");

  await createSession(user);
  return { ok: true };
});
