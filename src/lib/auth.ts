import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db, users, type User } from "@/db";
import { env } from "./env";

export const SESSION_COOKIE = "briefly_session";
const SESSION_DAYS = 30;

export class AuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
  }
}

function secretKey() {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: Pick<User, "id" | "tokenVersion">): Promise<void> {
  const token = await new SignJWT({ tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Returns the signed-in user or null. Verifies the signature and the revocation counter. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const [user] = await db().select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || user.tokenVersion !== payload.tv) return null;
    return user;
  } catch {
    return null;
  }
}

/** For route handlers: throws AuthError (mapped to 401 by the api wrapper). */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

/** For server components / layouts: redirects to /login. */
export async function requirePageUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?stale=1");
  return user;
}
