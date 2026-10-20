import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AuthError, requireUser } from "./auth";
import { UnsafeUrlError } from "./net";
import type { User } from "@/db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl, cron) — protected by the session cookie / secret instead
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

interface Ctx<P> {
  params: Promise<P>;
}

interface Options<S extends ZodTypeAny | undefined> {
  /** Require a signed-in user (default true). */
  auth?: boolean;
  /** Zod schema for the JSON body. */
  body?: S;
}

interface Args<P, S extends ZodTypeAny | undefined> {
  req: NextRequest;
  user: User;
  params: P;
  body: S extends ZodTypeAny ? z.infer<S> : undefined;
}

/**
 * Wraps a route handler with auth, same-origin CSRF protection on mutations,
 * body validation and uniform JSON error responses.
 */
export function route<P = Record<string, never>, S extends ZodTypeAny | undefined = undefined>(
  options: Options<S>,
  handler: (args: Args<P, S>) => Promise<Response | object>,
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating && !sameOrigin(req)) throw new HttpError(403, "Cross-origin request blocked");

      const user = options.auth === false ? (undefined as unknown as User) : await requireUser();

      let body: unknown = undefined;
      if (options.body) {
        const raw = await req.json().catch(() => {
          throw new HttpError(400, "Request body must be valid JSON");
        });
        body = options.body.parse(raw);
      }

      const params = (ctx?.params ? await ctx.params : {}) as P;
      const result = await handler({ req, user, params, body: body as Args<P, S>["body"] });
      return result instanceof Response ? result : json(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
  if (err instanceof AuthError) return json({ error: err.message }, { status: 401 });
  if (err instanceof UnsafeUrlError) return json({ error: err.message }, { status: 400 });
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return json({ error: `${where}${first?.message ?? "Invalid input"}` }, { status: 400 });
  }
  console.error("[api] Unhandled error:", err);
  return json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
