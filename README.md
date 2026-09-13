# Wonderful Intelligence

Three products on the existing Next.js 14 + TypeScript + Prisma/SQLite application:

- **Talent Intelligence:** learn an exploratory sourcing model from recorded post-hire outcomes, compare original/proposed/approved ranks, and approve a complete model version.
- **Company Scout:** select markets and sectors, evaluate a sample company directory with explicit scoring rules, inspect evidence and score history, and review outreach drafts.
- **External Radar:** classify stored mentions into themes, calculate historical trends, and surface threshold-based risk/opportunity alerts for each audience.

This is a **functional demo using synthetic data**, not a live web-monitoring or recruiting integration. Read [REVIEW.md](REVIEW.md) for the engineering/product findings and remaining work.

## Run locally

Node 22 and npm are the tested defaults.

```sh
npm ci
# Copy .env.example to .env; DATABASE_URL=file:./dev.db resolves relative to prisma/schema.prisma.
npx prisma migrate deploy
npm run seed  # DESTRUCTIVE: resets this database to synthetic fixtures; never run on real data.
npm run dev
```

For an existing database, do NOT seed again. Start the app, rerun Talent analysis, refresh Scout, and analyze Radar to derive updated results while preserving records.

```sh
npm test
npm run typecheck
npm run build
npm start
```

Install generates Prisma; build compiles the app without replacing Prisma's engine DLL while a Windows server is running. After schema edits, stop the server and run `npm run prisma:generate`. Build no longer migrates a running database. Run migrations explicitly before serving traffic. The build requires access to Google Fonts for its existing Inter font.

## What is real

- Correlations, Fisher confidence intervals, complete-outcome sample counts, signed learning coefficients, and candidate ranking are calculated from SQLite records. No geography or education features are used. The model is exploratory, correlational and **not holdout-validated**. Retention is not corrected for tenure opportunity.
- Analyses retain their findings and ranking snapshots. Approval saves the entire coefficient vector and normalization data in an append-only `active_model_approved` audit entry. The active ranking reads that saved version; a new proposal does not silently replace it. Sliders are a temporary simulation.
- Scout calls `ResearchProvider.discover/research`, deduplicates normalized company/country identities, prefers undiscovered then oldest-researched prospects, stores evidence and score history, and preserves human outreach state on rescans. Scores are rule-based scenario fit, not a calibrated buying probability. Directory employee counts and sector priors are unverified assumptions.
- Radar classifies mention text using disclosed keyword rules. Eight weekly buckets include zeros. The last three calendar weeks (current week partial) are compared against five earlier weeks. An alert requires three recent mentions, two distinct domains, and 60% directional sentiment (or explicit competitor instability). Synthetic records always receive low confidence. Lenses recompute the same analysis for the selected audience.
- Approval and outreach transitions are transactional. Approval never sends email. Recording an external send requires explicit confirmation, then replies advance prospect state. LinkedIn is manual. Feedback is saved for review; it does **not** train scoring.
- All agents persist runs, errors, steps and audit entries. CSV ingestion validates ranges and imports each row atomically; file/row fingerprints deduplicate retry attempts. Optional `candidateId` updates an existing record.

## Providers and access

| Setting | Implemented behavior |
|---|---|
| `DATABASE_URL` | Required SQLite URL; example uses `file:./dev.db`. PostgreSQL needs schema and migration changes, not just a URL change. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Optional real Talent narrative call, with a 15-second timeout and computed-summary fallback. It does not discover evidence or train the ranking model. |
| `SEARCH_PROVIDER_API_KEY` | Reserved. **No live adapter is implemented.** A key alone does nothing. Implement `ResearchProvider` discovery/research and a Radar ingestion adapter with verified provenance. |
| `EMAIL_PROVIDER_API_KEY` | Reserved. **No delivery adapter is implemented.** Requires recipients, sender setup, provider receipts and delivery webhooks. |
| `CRON_SECRET` | Required for external GET cron requests; unset means external cron is disabled. Local scheduling needs no secret. |
| `DEMO_ACCESS_TOKEN` | Optional HTTP Basic gate for the entire demo; use any username and this token as password. Keep it in environment secrets. Without this or upstream Cloudflare Access, anyone with the tunnel URL can read and change demo data. |
| `DISABLE_SCHEDULER=1` | Disable the in-process scheduler for tests/builds. |
| `NEXT_DIST_DIR` | Optional separate build directory, used to test production without replacing development build files. |

Do not import real candidate/customer data into an unprotected public demo. HTTP Basic over the tunnel's HTTPS or upstream Cloudflare Access is a demo gate; this is not multi-tenant authentication. In-memory rate limits and origin checks are defense in depth, not a distributed abuse-control service.

## Scheduling and persistence

A persistent Node process polls `ScheduledJob.nextRunAt` every 15 seconds. Schedules use **UTC**: Scout daily 07:00; Radar every 6 hours; Talent Mondays 06:00. Existing persisted due dates survive restart and missed jobs are picked up. Disabled jobs are skipped. A database lease prevents overlapping manual/scheduled runs; expired 15-minute leases are recovered. Failed scheduled attempts persist bounded 1/2-minute retries, then return to the normal cadence. Provider operations have bounded retries; Talent narrative failure preserves computed results.

SQLite is suitable for this single-instance demo. Use a persistent volume and backups. The Dockerfile stores data at `/app/data/dev.db`, runs migrations, seeds only a truly empty database, and fails startup if migration/seeding fails. The Render example uses an ephemeral free instance: records will not survive replacement unless you configure a durable disk. Mount persistence at `/app/data`.

Vercel cron configuration is included, but **the SQLite deployment is not serverless-ready**. A PostgreSQL port, authentication, request/runtime constraints and distributed job execution need validation first. The in-process scheduler is disabled on Vercel.

## Integration regression suite

Make a copy of the database named `review-test.db`, set `DATABASE_URL` to its absolute file URL, then run:

```sh
node --import tsx scripts/integration-test.ts
```

The script refuses databases whose URL does not contain `review-test`. It exercises real agents, APIs, approval gates, persisted scheduling and CSV ingestion. It modifies only that disposable copy; never point it at the public demo.
