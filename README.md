# Briefly

Zero-waste, mobile-first intelligence briefings for **📈 Markets**, **⚽ Sports** and **🌍 Geopolitics**.

Briefly pulls from curated RSS feeds every 4 hours, filters hard for relevance (before any AI is called), and uses *your own* free-tier AI key to produce a 3-bullet executive flash per domain plus compact story cards with a 3-tier insight view: **What happened → Why it matters → The angle**.

- **Stack:** Next.js 15 (App Router) · Tailwind CSS · PostgreSQL + Drizzle ORM (Neon-ready) · OpenAI-compatible client (Groq, Gemini, OpenRouter, OpenAI, custom)
- **Dark by default**, touch-first, fully responsive; installable as a PWA
- **Multi-user** with strict per-user data isolation; AI keys encrypted at rest (AES-256-GCM)
- **Saved debriefs** library for stories and macro trends

Docs: [Deployment guide](DEPLOYS_GUIDE.md) · [User guide](USER_GUIDE.md)

## How the pipeline works

1. **Fetch** — enabled feeds in parallel with conditional GET (ETag / Last-Modified), SSRF-guarded.
2. **Filter** — deterministic relevance scoring per domain (team weights, MMA/boxing/NBA gates, mute/boost keywords, recency); already-seen URLs and near-duplicate headlines are merged, with multi-outlet coverage boosting importance.
3. **Synthesise** — top candidates go to the AI in batches of 4 (article text fetched when the feed snippet is thin). The model also acts as a second filter and scores importance.
4. **Flash** — a 3-bullet executive summary per domain.
5. **Serve** — cards the user has scrolled past or dismissed never return.

```
src/lib/pipeline/   rss · relevance · cluster · article · summarize · run
src/lib/ai/         OpenAI-compatible client, prompts, JSON extraction
src/app/api/        auth · briefing · items · refresh · cron · feeds · saved · settings · account
src/db/schema.ts    Drizzle schema (migrations in ./drizzle)
```

## Quick start

```bash
npm install
cp .env.example .env.local && $EDITOR .env.local
npm run db:migrate
npm run dev
```

See [DEPLOYS_GUIDE.md](DEPLOYS_GUIDE.md) for Vercel + Neon deployment and the 4-hour scheduler.
