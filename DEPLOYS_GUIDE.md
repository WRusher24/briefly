# Briefly — Deployment Guide

This guide takes you from a fresh GitHub repository to a running production instance on **Vercel** with a free **Neon** PostgreSQL database. Total time: about 10 minutes.

## Architecture at a glance

| Piece | Technology |
| --- | --- |
| Web app + API | Next.js 15 (App Router), Tailwind CSS |
| Database | PostgreSQL via Drizzle ORM (Neon free tier) |
| AI | Each user's own OpenAI-compatible API key (Groq, Gemini, OpenRouter, OpenAI, …) |
| Scheduler | GitHub Actions calls `/api/cron/refresh` every 4 hours; the app also refreshes lazily when a stale briefing is opened |

> **Why GitHub Actions and not Vercel Cron?** Vercel's Hobby plan only allows cron jobs that run once per day, and deployments that declare a more frequent schedule are rejected. The included workflow (`.github/workflows/refresh.yml`) gives you a free 4-hour cadence. On a Vercel Pro plan you may add a `crons` entry to `vercel.json` instead (`{"crons":[{"path":"/api/cron/refresh","schedule":"0 */4 * * *"}]}`); Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.

---

## 1. Create the Neon database

1. Sign in at [neon.tech](https://neon.tech) and create a project (any region close to your Vercel region).
2. In **Connection Details**, enable **Connection pooling** and copy the connection string. It looks like:
   `postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
3. Keep it handy — this is your `DATABASE_URL`.

## 2. Push the code to GitHub

The repository is already initialised. If you are starting elsewhere:

```bash
git remote add origin https://github.com/<you>/briefly.git
git push -u origin main
```

## 3. Import the repository into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. Framework preset: **Next.js** (auto-detected). Leave build settings at their defaults — `package.json` defines a `vercel-build` script that **applies database migrations automatically** before building.
3. Add the **Environment Variables** below *before* the first deploy.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled connection string from step 1. |
| `AUTH_SECRET` | yes | Signs session cookies. Generate with `openssl rand -base64 48`. |
| `CRON_SECRET` | yes | Protects the refresh endpoint. Generate with `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | no | ≥ 32 chars; encrypts users' AI keys at rest. Defaults to a key derived from `AUTH_SECRET`. Changing it later invalidates stored AI keys. |
| `ALLOW_PRIVATE_HOSTS` | no | Leave unset in production. `true` allows localhost/private-network feeds and AI endpoints (local dev only). |

4. Click **Deploy**. When it finishes, open the URL, create an account and you are live.

### Function duration

Refresh routes declare `maxDuration = 300`. On Vercel Hobby with Fluid Compute this is honoured; if your plan caps it lower the pipeline still works — every AI batch is saved as it completes, and unfinished stories are picked up by the next run.

## 4. Enable the 4-hour automatic updates

In your GitHub repository go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
| --- | --- |
| `APP_URL` | Your production URL, e.g. `https://briefly-yourname.vercel.app` |
| `CRON_SECRET` | The exact same value as the Vercel env var |

Then open **Actions → Refresh briefings → Run workflow** once to verify. A successful run prints something like `{"attempted":1,"succeeded":1,"skipped":0}`.

Only users who have saved an AI API key are processed, oldest briefing first.

---

## Running locally

Requirements: Node.js ≥ 20.9 and a PostgreSQL database (a free Neon branch works well, or local Postgres).

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run db:migrate              # creates all tables
npm run dev                     # http://localhost:3000
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (RSS parsing, relevance filter, clustering, crypto, SSRF guard) |
| `npm run db:generate` | Generate a new SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database with Drizzle Studio |

Trigger the scheduled job manually:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh
```

## Updating the schema

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` and commit the new file in `drizzle/`.
3. Push — Vercel runs `db:migrate` during the build.

## Security notes

- Passwords are hashed with bcrypt; sessions are signed, `httpOnly`, `SameSite=Lax` JWT cookies and are revoked on password change.
- Every query is scoped by `user_id`; account deletion cascades to all of a user's data.
- AI keys are encrypted with AES-256-GCM and never sent back to the browser.
- Server-side fetches (feeds, article text, AI endpoints) block private/loopback addresses and re-validate every redirect.
- Login, sign-up, refresh and connection-test endpoints are rate-limited in Postgres, so limits hold across serverless instances.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build fails with "Invalid environment configuration" | One of `DATABASE_URL`, `AUTH_SECRET` (≥ 32 chars) is missing in Vercel. |
| Pages show "Something went wrong" | Check the Vercel function logs; usually a wrong `DATABASE_URL` or migrations not applied (`npm run db:migrate`). |
| Briefing stays empty after adding a key | Open Settings → AI and press **Test connection**; then tap **Refresh** on the briefing. The last failure reason is shown on the briefing screen. |
| Many feeds show a red dot | Some publishers block automated requests or retire feeds. Disable or delete them under Settings → Sources, or add replacements. |
| Free-tier rate limits (HTTP 429) | Lower "New stories per domain" in Preferences, or choose a faster/larger-quota model. |
