import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Fixed-window counter stored in Postgres so it holds across serverless instances.
 * Returns true when the call is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
    returning count
  `);
  const count = Number((rows as unknown as Array<{ count: number }>)[0]?.count ?? 1);
  return count <= limit;
}

export async function pruneRateLimits(): Promise<void> {
  await db().execute(sql`delete from rate_limits where reset_at < now() - interval '1 hour'`);
}
