# Engineering and product review — 2026-09-13

## Verification status

The original implementation was inspected across all tracked source files, schema/migrations, APIs, agents, seed providers, scheduler, deployment configuration and UI. Existing stack retained; no rebuild from scratch.

The review fixes passed 19 unit/regression tests, the integration suite, TypeScript checking and a production build. Afterward another editor changed the shared schema, Talent model and product screens during this same review. The latest integration rerun is **not passing**: the retained-ranking assertion expected 660 rows but found 220 after two new analyses. The new migration was applied only to the isolated final test database by this review. The workspace is still changing, so earlier passing checks do not certify the current combined implementation. Do not merge or present this as a verified final release until the concurrent work is reconciled.

## Critical findings in the original app

1. Talent analysis deleted all earlier findings/rankings and pending proposals. Existing approvals could reference deleted entities. Approving a proposal did not apply a sourcing model.
2. Scout opportunity components were seeded random draws. Explanations were generic sector text, with empty evidence references. Repeated scans sliced the first companies before deduplication and never progressed or rescored them.
3. Radar fixtures already specified themes, alert titles, severity and confidence. Scans simulated source counts, occasionally added canned mentions, and did not actually cluster incoming text. Missing weeks were excluded from trend baselines. Lenses filtered mentions but not themes/alerts.
4. ResearchProvider had no discovery/research methods. Setting a search key advertised a live provider without implementing one. Email had no delivery adapter despite suggestive UI text.
5. AgentRun and ScheduledJob persistence existed, but jobs had no retry policy, shared run lease or missed-run recovery. New agent-created proposals/drafts did not consistently create approval items; this happened mainly during seeding.
6. UI failures were often silent. Candidate browsing exposed only the first 25 rows. Scout replayed a progress animation after execution. Score-history data was returned but not displayed. Feedback clicks gave little confirmation and did not train anything.
7. Docker database paths were inconsistent with Prisma's relative-path resolution. Startup could continue after migration/seed failure. Checking only candidate count before destructive auto-seeding could erase other product data. PostgreSQL/live-provider readiness was overstated.
8. Public access was not authenticated by the app. Anyone with an unprotected tunnel link could inspect and mutate the shared demo. The public origin was a development server whose process stopped during review.

## Real versus demo-only

| Product | Already real | Originally simulated/incomplete |
|---|---|---|
| Talent | SQLite candidates/outcomes; Pearson calculation; outcome-derived feature weighting; pre-hire feature reranking | 220 synthetic candidates, 45 complete post-hire outcomes; no validated hiring lift; approvals did not activate a model; history deleted |
| Scout | Country/sector filters, unique prospect keys, evidence rows, draft storage and run records | Fixed company directory, random component scores, generic evidence, unverified buyer roles, no live search or email |
| Radar | Stored mention history and count aggregation | Preassigned clusters/alerts, fake source-check totals, canned scan updates, lens-independent alert analysis |
| Shared runtime | Server-side cron startup, database job/run rows, some human audit actions | No durable retries/overlap protection; incomplete approval creation and traceability |

## Review fixes implemented before concurrent redesign

- Talent: complete-outcome denominators; unknown hiring decisions excluded; Fisher intervals; corrected significance calculation; minimum sample/variation checks; signed model coefficients; retained versioned findings/rankings; complete-model approval and saved active normalization; outcome editing and original/proposed/active comparison.
- Scout: working injectable discovery/research interface with honestly demo-only implementation; deterministic documented scoring; evidence IDs per matching component; normalized deduplication; discovery progresses through the directory; rescans save score snapshots; old unsupported draft claims revised only before approval; real transactional approval/manual-send/reply states.
- Radar: explicit text-rule clustering; eight zero-filled weekly buckets; evidence/source/sentiment thresholds; positive and competitor opportunities; low confidence for synthetic inputs; audience-specific recomputation; persisted alert evidence/audit snapshots; no fabricated mentions during scheduled scans; explicit deduplicated scenario loading.
- Runtime: database run leases; persisted due-time polling and bounded retries; recovery of missed schedules; all-company Radar scans; inspectable activity/errors; cron-secret validation; optional demo access gate; origin/request limits; validated atomic CSV rows with retry deduplication; surfaced UI errors; corrected startup/persistence documentation.

## External deployment checks

URL: https://race-homework-bull-holder.trycloudflare.com

Initially the launcher, all three product pages and their APIs returned HTTP 502. The existing cloudflared process targeted localhost:3000, whose application process was no longer listening. Launching the app as a hidden independent process restored the tunnel.

Subsequently /talent, /scout and /radar returned HTTP 200 publicly and locally. The JSON responses for /api/talent/summary, /api/scout/prospects, /api/radar/overview and /api/agents/status matched exactly. Development HTML differs by request context and is not a byte-for-byte deployment identity test.

Browser checks confirmed the public launcher, Scout scan interaction and Radar lens selection. A public Scout UI scan accepted eight new prospects; the full public refresh evaluated 50 companies, added 10 and refreshed 40. Public Radar recomputation analyzed 27 stored mentions and created four threshold-derived alerts; selecting Candidate reduced the display to the workload/culture theme and its relevant alert. Talent's local rerun displayed calculated intervals and the corrected 89 known hire decisions, excluding 131 unknown outcomes. The later public Talent screen was renamed Sourcing Optimizer by the concurrent editor, so its newest behavior still needs reconciliation.

## Still required

- Implement and credential live web/news/review ingestion, provenance validation and named-contact enrichment. A search key alone is insufficient.
- Implement email delivery, verified recipients/senders, provider receipts and reply webhooks. Existing states record manual activity only.
- Connect ATS/HRIS outcome sources; validate on held-out real outcomes, address tenure censoring and group bias before using recruiting scores operationally.
- Protect public access, use persistent storage/backups and a supervised production process. Multi-tenant permissions and distributed job execution are not implemented.

## Five highest-value product improvements

1. A short guided evidence-to-decision-to-approval story per product, with an explicit next action.
2. One real, verifiable source integration to contrast live evidence with sample scenarios.
3. A credible Talent validation card with holdout size, uncertainty and failure cases; never guaranteed lift.
4. A Scout pipeline centered on verified buying contacts, draft review, replies and meetings.
5. A Radar change inbox showing what changed since the last run, why it crossed a threshold and who owns the response.

## Demo recommendation

The corrected rule-driven version is suitable for a clearly disclosed synthetic workflow demonstration, not a claim of live autonomous research or validated recruiting improvement. **The current concurrently changing workspace is not yet certified for the Wonderful demo.** Freeze edits, reconcile the new schema/model changes, rerun tests/build, and then commit the verified result.
