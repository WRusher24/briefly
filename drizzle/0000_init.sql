CREATE TYPE "public"."domain" AS ENUM('markets', 'sports', 'geopolitics');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending', 'ready', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'success', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."saved_kind" AS ENUM('story', 'trend');--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" "domain" NOT NULL,
	"subtopic" text DEFAULT 'General' NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"etag" text,
	"last_modified" text,
	"last_fetched_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"last_item_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flash_briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" "domain" NOT NULL,
	"bullets" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feed_id" uuid,
	"domain" "domain" NOT NULL,
	"url_hash" text NOT NULL,
	"url" text NOT NULL,
	"source_name" text NOT NULL,
	"title" text NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"relevance" real DEFAULT 0 NOT NULL,
	"importance" real,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"insight" jsonb,
	"read_seconds" integer,
	"seen_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"stats" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_debriefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid,
	"kind" "saved_kind" DEFAULT 'story' NOT NULL,
	"domain" "domain" NOT NULL,
	"title" text NOT NULL,
	"tldr" text DEFAULT '' NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ai_provider" text DEFAULT 'groq' NOT NULL,
	"ai_base_url" text DEFAULT 'https://api.groq.com/openai/v1' NOT NULL,
	"ai_model" text DEFAULT 'llama-3.3-70b-versatile' NOT NULL,
	"ai_api_key_enc" text,
	"ai_key_last4" text,
	"preferences" jsonb,
	"last_refresh_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flash_briefings" ADD CONSTRAINT "flash_briefings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_runs" ADD CONSTRAINT "refresh_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_debriefs" ADD CONSTRAINT "saved_debriefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feeds_user_url_idx" ON "feeds" USING btree ("user_id","url");--> statement-breakpoint
CREATE INDEX "feeds_user_domain_idx" ON "feeds" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "flash_user_domain_idx" ON "flash_briefings" USING btree ("user_id","domain","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "items_user_url_idx" ON "items" USING btree ("user_id","url_hash");--> statement-breakpoint
CREATE INDEX "items_feed_idx" ON "items" USING btree ("user_id","domain","status","created_at");--> statement-breakpoint
CREATE INDEX "runs_user_idx" ON "refresh_runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "saved_user_idx" ON "saved_debriefs" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_user_item_idx" ON "saved_debriefs" USING btree ("user_id","item_id") WHERE "saved_debriefs"."item_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree (lower("email"));