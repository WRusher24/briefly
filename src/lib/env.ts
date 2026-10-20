import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
  ENCRYPTION_KEY: z.string().min(32).optional().or(z.literal("").transform(() => undefined)),
  ALLOW_PRIVATE_HOSTS: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validated environment, resolved lazily so `next build` works without secrets. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || undefined,
    ALLOW_PRIVATE_HOSTS: process.env.ALLOW_PRIVATE_HOSTS,
  });
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${detail}`);
  }
  cached = parsed.data;
  return cached;
}
