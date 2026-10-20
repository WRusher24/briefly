import type { NextRequest } from "next/server";
import { errorResponse, HttpError, json } from "@/lib/api";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { runDueRefreshes } from "@/lib/pipeline/run";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  try {
    const secret = env().CRON_SECRET;
    if (!secret) throw new HttpError(503, "CRON_SECRET is not configured");
    const header = req.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ") || !safeEqual(header.slice(7), secret)) throw new HttpError(401, "Unauthorized");
    return json(await runDueRefreshes());
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = handle;
export const POST = handle;
