# Engineering and product review — cycle 2026-09-13 (night)

## Post-review fix pass (same night, before sharing)

A manual review of this cycle's output caught a real bug before it reached
anyone: ABN AMRO's "verified" contact was Gerrit Zalm, who left as CEO in
2017 — `wikidata.ts` took `claims.P169[0]` without checking whether that
claim's tenure had ended. Fixed to check each claim's rank and P582
(end-time) qualifier; ambiguous cases now return "not verified" instead of
guessing. The fix also reconciles existing saved contacts on every future
scan (not just new ones going forward) — a stale contact's outreach is
deleted and its pending approval superseded, with an audit entry recording
what happened. Also removed a leftover `{{sender_name}}` placeholder from
"ready to send" drafts, stopped citing old (2014/2017) evidence as "why
now," fixed a stale banner claim, and added a dynamic "explore a real
example" link + a short "how it works" section to the launcher. Full detail
in the commit for this pass. Re-verified: typecheck, tests, build,
integration suite, public tunnel, commit-SHA match — all clean.



Context for this cycle: the target is a link sent to a specific external
evaluator (Wonderful) to demonstrate hands-on ability to build and ship real
products with AI coding agents. Priority order given: Growth → Radar →
Sourcing → public demo check. Explicit instruction: no more fabricated
success data, make technical decisions autonomously, ask only for secrets/
external accounts/send approval.

## Growth Agent — rebuilt as the central proof (highest priority)

The default/scheduled/seeded scan (`runLiveGrowthDiscovery` in
[`src/lib/agents/scoutAgent.ts`](src/lib/agents/scoutAgent.ts)) is now real,
not the curated sample:

- **Real company evidence** — Wikipedia + Hacker News per company (existing
  `fetchLiveEvidence`, reused, not reinvented).
- **Real, verified executive contact** — new
  [`src/lib/wikidata.ts`](src/lib/wikidata.ts): looks up the company on
  Wikidata and reads a *structured claim* (P169 chief executive officer, or
  P1037 director/manager as fallback) — not full-text search, so it doesn't
  have the earlier "A2A" keyword-collision problem (a real result about the
  wrong real thing). When no claim exists, **no name is guessed** and **no
  outreach draft is created** — the UI shows "No verified contact found."
  Verified live at seed time: 10 companies checked, 2 real named executives
  found — **Ahold Delhaize → Frans Muller** (its actual CEO) and **ABN AMRO
  → Gerrit Zalm** — each with a Wikidata source link.
- **Complete, non-placeholder outreach drafts** — only generated when both a
  real person and real evidence exist, composed from that real content
  (e.g. a real Wikipedia extract), never a bracketed placeholder.
- **Honest, documented scoring** (`scoreLiveCompany` in
  [`src/lib/scoutScoring.ts`](src/lib/scoutScoring.ts)): company scale +
  evidence found + verified contact found. Replaces the old keyword-matched
  "operational pain" categories, which were written against curated demo
  vocabulary and didn't match real article text.
- **Demo/real separation is now structural, not just labeling**: `Prospect`
  gained `discoveryMode` (`demo` | `live` | `manual`), and `dedupeKey` is
  mode-prefixed so a demo and a live account for the same company can never
  collide. `/api/scout/summary` and `/api/scout/prospects` are scoped to
  `live`+`manual` by default — demo-scenario accounts (and any pipeline
  progress on them) never count toward the real numbers shown. The old
  curated scan is kept only as an explicit "Load sample scenario" action.
- **No more seeded fake success** — the previous cycle's seeded
  approve→send→reply→meeting-booked progression on demo accounts is
  removed per this cycle's explicit instruction. Contacted/Replied/Meeting
  Booked start at a real zero and only move when a human genuinely does it.
- **Source-failure honesty**: `fetchLiveEvidenceDetailed` (new) distinguishes
  a genuine fetch error (timeout/network/HTTP error) from a confirmed empty
  result; a run with a source error says so in its steps/warnings instead of
  silently reporting "no evidence found."

## Radar

- Fixed the heading overclaim: "What changed since yesterday" → "What
  changed this week" (the computation is weekly, not daily) — kept the
  "X this week" + baseline text as supporting detail.
- Same source-error-vs-empty-result honesty fix as Growth Agent, applied to
  `ingestLiveCompanyMentions`.
- Rerun-with-no-change already does not create a new alert (verified in
  code and by the integration suite: `existing ? update : create`, keyed by
  theme, not a fresh row every scan) — pre-existing, not new this cycle.
- Confidence already required source-domain diversity, not just mention
  count, and already capped at LOW whenever any synthetic mention is
  involved — pre-existing, verified still correct.
- Fixed the audienceLens mislabeling from the previous cycle (real mentions
  were defaulting to "EXECUTIVE" with no actual basis) — carried over,
  unchanged this cycle.

## Sourcing Optimizer

- Added an explicit small-holdout-size caveat next to the VALIDATION PASSED
  badge ("read this as directional, not proof...") so the headline number
  isn't presented as more certain than a 24-candidate holdout supports.
- Verified (not changed): a new analysis run already supersedes any stale
  PENDING approval proposal before creating a new one
  (`sourcingWeightProposal.updateMany({status:'PENDING'}, {status:
  'SUPERSEDED'})` in talentAgent.ts) — outcome changes can't leave a stale
  proposal approvable.
- Isolated scenario testing for a reviewer: already possible via
  `scripts/integration-test.ts` against a disposable database copy (hard
  safety check requires the URL to contain "review-test") — used
  extensively this cycle itself as proof, not new infrastructure.

## Shared / infra

- New `/api/version` + a footer on every page showing the running git
  commit hash — verified through the public tunnel to match `git rev-parse
  --short HEAD` exactly, so what's deployed can be checked against what's
  claimed rather than taken on faith.
- Scheduler runs from `src/instrumentation.ts` (Next.js's server-boot hook)
  — starts with the process, no browser involved. "Runs without a click" is
  additionally proven directly by the integration suite, which calls
  `schedulerTick()` with no HTTP/browser involvement and asserts a new
  `AgentRun` is created.
- Restart survival: demonstrated empirically many times this session
  (dev.db persists across every server stop/restart in this cycle and
  earlier ones).
- No unauthorized real sends possible: `manualConfirmed:true` is required
  server-side for any outreach to reach `SENT`; no email-sending adapter is
  wired (Resend requires `RESEND_API_KEY`/`ALERT_EMAIL_FROM`, not
  configured); no LinkedIn API integration exists — sending is always a
  manual human action outside the app.
- Public access is still unauthenticated (unchanged, pre-existing, flagged
  again for visibility): anyone with the tunnel link can trigger scans and
  add data. No real send capability is reachable regardless.

## Full verification this cycle

`npx tsc --noEmit` clean · `npm test` 21/21 · production build clean ·
`scripts/integration-test.ts` 6/6 against a fresh disposable DB copy (two
assertions rescoped to `discoveryMode:'demo'` now that live and demo
accounts coexist in the same tables) · manual verification in a fresh
browser tab across all three product pages, zero console errors · all four
routes return HTTP 200 in under 0.6s through the public tunnel · `/api/
version` through the tunnel matches local `git rev-parse --short HEAD`
exactly.

## What's genuinely functional right now

- Growth Agent's default path: real evidence, real verified-executive
  lookup, real complete drafts, for any company in the current 50-company
  target list or one you add by name.
- Radar: every tracked company (including "Wonderful," searched as
  `wonderful.ai`) is checked against real live sources every scan.
- Sourcing Optimizer: V1-vs-V2 validation computed from real correlations on
  real stored data, holdout-validated, with its statistical limits now
  stated next to the headline.
- Self-serve real email alerts (Radar) — pipeline built, not yet connected
  (needs `RESEND_API_KEY` + `ALERT_EMAIL_FROM`, still waiting on you).

## What's still demo-only

- The original 50-company curated scenario (`Load sample scenario` button)
  — kept for illustrating the mechanics, fully excluded from real stats.
- The default "Wonderful" Radar company's original seeded mentions (real
  live checks run alongside them now, each individually flagged).
- All 424 Sourcing Optimizer candidates (no real ATS/HRIS connected).

## Blocked — precisely what's missing

- **Real email sending**: code path exists (`src/lib/email.ts`, Resend
  HTTP API), needs `RESEND_API_KEY` and `ALERT_EMAIL_FROM` — a credential,
  not missing code.
- **Real LinkedIn sending**: not attempted — automating LinkedIn without
  their authorization would violate their terms of service; stays a manual
  human handoff by design, not something a credential would unlock.
- **Public access control**: missing code — no auth layer exists yet.
- **Executive contact coverage beyond what Wikidata has**: for a company
  with no Wikidata CEO/director claim, there is currently no second real
  source to fall back to — this is a real coverage gap, not a bug.

## Next cycle candidates (not started)

- A way to attach a manually-known real contact directly to an existing
  live-discovered prospect (currently "Add a real target" creates a
  separate prospect row rather than merging into one).
- Public access auth.

## Independent review — leadership monitoring (2026-09-14)

### CRITICAL
- No CRM, Growth delivery/reply ingestion or calendar connectors exist. Credentials alone do not implement these workflows. The Growth page now states the implementation and authorization requirements explicitly.
- Synthetic Radar mentions must never trigger real subscriber emails. The threshold now excludes demo mentions; signal cards also visibly identify synthetic evidence.

### IMPORTANT
- Implemented seven-person Wonderful leadership watchlist sourced from the official about-us page (verified 2026-09-14), Google News RSS searches, a 90-day publication window, bounded retries/timeouts, URL deduplication, persistent Evidence records and audit scan outcomes. Called by the existing scheduled Radar agent, with no schema migration or private data access.
- These are public search-index matches, NOT full-article fact verification. UI distinguishes visible name metadata from unverified indexed person matches. Dates come from RSS; first-captured timestamps persist. News volume is not fabricated sentiment or proof of a risk.
- Existing company news coverage remains limited (Wikipedia/HN failures are surfaced). Leadership news is separate from synthetic trend fixtures and audience lenses.
- Local provider smoke test returned 11 distinct real indexed articles and no source failures. Parser tests cover company identity, name-match disclosure, dates, unsafe URLs, duplicates and invalid feeds.

### NICE TO HAVE
- Refresh the sourced leadership watchlist periodically, add Hebrew coverage, and verify named-person context in full articles using a vetted research provider.

### Next Builder Actions
1. Implement an authorized CRM adapter with customer/open-deal matching and account ownership before claiming CRM-aware discovery; support public-company lookalikes separately from private customer status.
2. Add Israel enterprise discovery with verifiable sector/scale evidence; do not imply Bezeq or banks are net-new Wonderful accounts without CRM evidence.
3. Implement email delivery + reply webhooks and calendar free/busy + explicit booking flow before claiming autonomous meetings. Use sandbox accounts first.
4. Separate all synthetic Radar trends from live management signals by default; improve live evidence classification and historical coverage before claiming sentiment-based alerts.
5. Add tests for persistent leadership scan dedup and provider outage retention against a disposable PostgreSQL database.
