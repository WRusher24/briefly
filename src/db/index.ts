import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __brieflyDb?: Db };

function create(): Db {
  // Neon's pooled endpoint (pgbouncer, transaction mode) does not support
  // prepared statements; `max: 1` keeps one connection per serverless instance.
  const client = postgres(env().DATABASE_URL, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return drizzle(client, { schema });
}

/** Lazily-created singleton so importing this module never needs env at build time. */
export function db(): Db {
  if (!globalForDb.__brieflyDb) globalForDb.__brieflyDb = create();
  return globalForDb.__brieflyDb;
}

export * from "./schema";
