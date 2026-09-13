# Wonderful Intelligence

One launcher, three autonomous intelligence products for Wonderful, sharing a common agent
infrastructure (database, scheduler, evidence store, approval layer, audit log).

- **Talent Intelligence** — closed-loop recruiting analytics. Learns which sourced candidates
  actually became successful hires, computes real correlations (with sample size and
  confidence, never causal claims), and proposes sourcing-weight changes that require human
  approval before they'd apply.
- **Company Scout** — an autonomous enterprise-prospecting agent for Germany, the UK, France,
  Italy, and the Netherlands (more countries are a one-line addition). Discovers companies,
  scores them with an explainable breakdown, finds likely decision-maker roles, and drafts
  outreach (email stays approval-gated; LinkedIn is always a manual copy/paste handoff).
- **External Radar** — an early-warning intelligence agent. Turns individual mentions into
  themes, themes into trends, and trends into confidence-scored risk/opportunity alerts, with
  an audience-lens switch (Candidate / Customer / Executive / Investor).

All three write to shared `AgentRun` / `ApprovalItem` / `Evidence` / `AuditLogEntry` tables so
every autonomous action is inspectable — click into any run, prospect, or alert to see exactly
why the system did what it did.

## Demo data, clearly labeled

There's no live web-search or ATS/HRIS credential in this environment, so:

- Talent Intelligence ships with 220 synthetic (but statistically realistic) candidates —
  generated with real, documented signal baked in, so the correlation engine has to actually
  find it rather than being handed the answer.
- Company Scout targets **real company names** (that's the point of a prospecting tool), but
  every piece of "evidence" attached to them is explicitly synthetic and labeled `Demo data` /
  `isDemo: true`, and every source link points at a real top-level domain (the company's own
  site, or a real platform's homepage) — never a fabricated article or review URL. Decision
  makers are represented as **roles**, not invented named individuals.
- External Radar defaults to tracking "Wonderful" itself with the same clearly-labeled synthetic
  mentions. You can add any other company from the product UI — it starts empty until you
  connect a live source or seed it.

Swapping in real providers later is a config change, not a rewrite — see `src/lib/llm.ts` and
`src/lib/research.ts`.

## Stack

Next.js 14 (App Router, TypeScript) + Prisma + SQLite, Tailwind, Recharts, a small in-process
cron scheduler (`croner`). Chosen for speed: one deployable app, zero external services required
to run locally.

## Local setup

```bash
npm install
npm run seed      # populates ~220 candidates, ~30 prospects, and radar signal history
npm run dev
```

Open http://localhost:3000. `npm run seed` is destructive (it clears and regenerates demo data) —
safe to re-run any time you want a fresh dataset.

### Environment variables (all optional — see `.env.example`)

| Variable | Effect if unset |
|---|---|
| `DATABASE_URL` | Defaults to a local SQLite file — zero setup |
| `ANTHROPIC_API_KEY` | Talent Intelligence's narrative interpretation runs in a deterministic "demo" mode (real numbers, templated prose) instead of calling a live model |
| `SEARCH_PROVIDER_API_KEY` | Company Scout / Radar use the built-in demo research provider instead of live search |
| `EMAIL_PROVIDER_API_KEY` | Outreach emails stay in Draft/Awaiting Approval — nothing is ever sent automatically |
| `CRON_SECRET` | If set, external cron calls to `GET /api/agents/run` must send `Authorization: Bearer <value>` |

## How scheduling works

`src/instrumentation.ts` starts an in-process scheduler (`src/lib/scheduler.ts`) on server boot —
this works as long as the app runs as a **persistent Node process** (local dev, Docker, Render,
Fly, Railway). Default schedule: Company Scout daily at 07:00, External Radar every 6 hours,
Talent Intelligence weekly. Edit `DEFAULT_JOBS` in `scheduler.ts`, or the `ScheduledJob` rows in
the database, to change cadence — nothing is hardcoded to a single interval.

If you deploy to a serverless platform (Vercel) instead, the process doesn't stay alive between
requests, so the scheduler won't fire on its own — use `vercel.json`'s Cron Jobs (already
configured) to hit `GET /api/agents/run?agentKey=...` on a schedule instead.

## Deployment

**The app needs zero infrastructure from you beyond picking a host and connecting your GitHub
account — that step genuinely can't be done on your behalf, since it requires your own login.**

### Option A — Render (recommended: simplest full-featured path)

Persistent Node process, so the in-process scheduler works out of the box and SQLite just works.

1. Push this repo to GitHub (see below).
2. Go to [render.com](https://render.com) → New → Blueprint → connect the repo. Render reads
   `render.yaml` automatically and deploys the Dockerfile.
3. Click Deploy. First boot runs migrations and seeds demo data automatically.

Render's free tier disk is ephemeral (reset on redeploy) — fine for a demo; the container
reseeds itself on start if the database is empty (`scripts/seed-if-empty.js`). For durable
production data, add a paid persistent disk in the Render dashboard, or swap `DATABASE_URL` to a
hosted Postgres (see below) — either is a config change, not a code change.

### Option B — Fly.io / Railway

Same Dockerfile works as-is; both support persistent volumes if you want SQLite data to survive
redeploys. Point a volume at `/app/prisma` and set `DATABASE_URL=file:./prisma/dev.db`.

### Option C — Vercel (fastest click-to-deploy, needs one extra step)

Vercel's serverless functions don't keep a process alive, so:

1. Provision a free Postgres database (e.g. [Neon](https://neon.tech) or Vercel Postgres) and
   change `prisma/schema.prisma`'s datasource `provider` to `"postgresql"`, then
   `npx prisma migrate dev` once locally against that URL to regenerate migrations.
2. Import the repo into Vercel, set `DATABASE_URL` to the Postgres connection string.
3. `vercel.json` already defines the three Cron Jobs that replace the in-process scheduler.

### Pushing this repo to GitHub

```bash
git remote add origin https://github.com/<you>/wonderful-intelligence.git
git push -u origin main
```

## Working with OpenAI Codex

This project is set up to be opened directly in the Codex app.

### Opening this folder in Codex on Windows

1. Install the Codex app (or the Codex CLI/IDE extension you use) if you haven't already.
2. Open the Codex app.
3. Choose **Open Folder** (or **Open Project**) from the Codex app's start screen or File menu.
4. Navigate to and select this folder:
   ```
   C:\wonderful.ai\wonderful-demo
   ```
5. Confirm/open — Codex will load the repository at that path and pick up this `README.md` and
   `.gitignore` automatically.

If your Codex app instead prompts for a Git remote URL rather than a local folder, push this
repository to your Git host (e.g. GitHub) first, then provide that URL when opening the project
in Codex.

## Project layout

```
prisma/schema.prisma       shared data model for all three products
prisma/seed.ts             demo data generation + initial agent runs
src/lib/agents/            talentAgent.ts, scoutAgent.ts, radarAgent.ts — the actual agent logic
src/lib/scheduler.ts        in-process job scheduler
src/lib/llm.ts               LLM provider abstraction (demo + live)
src/lib/research.ts          web research provider abstraction (demo + live)
src/app/(page.tsx)          launcher / "Digital Workforce" control room
src/app/talent/             Talent Intelligence product
src/app/scout/              Company Scout product
src/app/radar/              External Radar product
src/app/api/                REST API routes backing all three products
```
