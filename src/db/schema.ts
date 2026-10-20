import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Preferences } from "@/lib/preferences";

export const domainEnum = pgEnum("domain", ["markets", "sports", "geopolitics"]);
export const itemStatusEnum = pgEnum("item_status", ["pending", "ready", "rejected", "failed"]);
export const savedKindEnum = pgEnum("saved_kind", ["story", "trend"]);
export const runStatusEnum = pgEnum("run_status", ["running", "success", "partial", "failed"]);

export interface InsightPayload {
  headline: string;
  tldr: string;
  facts: string[];
  why: string;
  angle: string;
}

export interface SourceRef {
  name: string;
  url: string;
}

export interface RunStats {
  feedsFetched: number;
  feedsFailed: number;
  rawItems: number;
  candidates: number;
  processed: number;
  rejected: number;
  failed: number;
  aiCalls: number;
}

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** Bumped on password change so existing sessions are revoked. */
    tokenVersion: integer("token_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  aiProvider: text("ai_provider").notNull().default("groq"),
  aiBaseUrl: text("ai_base_url").notNull().default("https://api.groq.com/openai/v1"),
  aiModel: text("ai_model").notNull().default("llama-3.3-70b-versatile"),
  /** AES-256-GCM encrypted, see lib/crypto.ts. Never returned to the client. */
  aiApiKeyEnc: text("ai_api_key_enc"),
  aiKeyLast4: text("ai_key_last4"),
  preferences: jsonb("preferences").$type<Preferences>(),
  lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feeds = pgTable(
  "feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: domainEnum("domain").notNull(),
    subtopic: text("subtopic").notNull().default("General"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    etag: text("etag"),
    lastModified: text("last_modified"),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    lastItemCount: integer("last_item_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("feeds_user_url_idx").on(t.userId, t.url),
    index("feeds_user_domain_idx").on(t.userId, t.domain),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feedId: uuid("feed_id").references(() => feeds.id, { onDelete: "set null" }),
    domain: domainEnum("domain").notNull(),
    urlHash: text("url_hash").notNull(),
    url: text("url").notNull(),
    sourceName: text("source_name").notNull(),
    title: text("title").notNull(),
    rawText: text("raw_text").notNull().default(""),
    sources: jsonb("sources").$type<SourceRef[]>().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    relevance: real("relevance").notNull().default(0),
    importance: real("importance"),
    status: itemStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    insight: jsonb("insight").$type<InsightPayload>(),
    readSeconds: integer("read_seconds"),
    /** Set once the card has scrolled out of view after being seen — it never reappears. */
    seenAt: timestamp("seen_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("items_user_url_idx").on(t.userId, t.urlHash),
    index("items_feed_idx").on(t.userId, t.domain, t.status, t.createdAt),
  ],
);

export const flashBriefings = pgTable(
  "flash_briefings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: domainEnum("domain").notNull(),
    bullets: jsonb("bullets").$type<string[]>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("flash_user_domain_idx").on(t.userId, t.domain, t.generatedAt)],
);

export const savedDebriefs = pgTable(
  "saved_debriefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Source item (null for trends, or once the raw item has been pruned). Not a FK on purpose: saved snapshots outlive items. */
    itemId: uuid("item_id"),
    kind: savedKindEnum("kind").notNull().default("story"),
    domain: domainEnum("domain").notNull(),
    title: text("title").notNull(),
    tldr: text("tldr").notNull().default(""),
    facts: jsonb("facts").$type<string[]>().notNull().default([]),
    why: text("why").notNull().default(""),
    angle: text("angle").notNull().default(""),
    sources: jsonb("sources").$type<SourceRef[]>().notNull().default([]),
    note: text("note").notNull().default(""),
    /** Original publication time, used for the historical timeline. */
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("saved_user_idx").on(t.userId, t.savedAt),
    uniqueIndex("saved_user_item_idx").on(t.userId, t.itemId).where(sql`${t.itemId} is not null`),
  ],
);

export const refreshRuns = pgTable(
  "refresh_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    stats: jsonb("stats").$type<RunStats>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_user_idx").on(t.userId, t.startedAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type Feed = typeof feeds.$inferSelect;
export type Item = typeof items.$inferSelect;
export type SavedDebrief = typeof savedDebriefs.$inferSelect;
