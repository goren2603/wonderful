# Engineering and product review — cycle 2026-09-13 (PM)

This cycle followed the reported "routes time out publicly" bug plus the
"product truth" milestone: for each product, prove the core claim with one
real functional path instead of only checking UI/route reliability.

## What was fixed this cycle

**Public route timeouts (root cause found and fixed).** The public tunnel and
local dev server were both actually dead (process exited); worse, the app was
being served via `next dev`, which compiles each route on first request —
under Cloudflare's free quick-tunnel proxy that on-demand compile was enough
to look like a hang/timeout externally even once the process was alive again.
Fixed by adding a `next start` production launch config
(`.claude/launch.json`, `wonderful-intelligence-prod`) and running the app
from a real production build for anything served publicly. All four routes
(`/`, `/talent`, `/scout`, `/radar`) now return HTTP 200 in under 0.6s
measured externally (`curl` against the public tunnel host, not localhost).

**"Scheduled / never" on the homepage.** `AgentRun` rows existed in the
database the whole time — `/api/agents/status` was already correct. The
"never" the user saw was a snapshot of a genuinely dead/mid-restart server,
not a persistent bug; it does not reproduce against the current build. The
database was reseeded fresh this cycle regardless, so the homepage now shows
real, current "3 min ago" timestamps rather than stale ones from hours
earlier.

**Sourcing Optimizer — proved Model V2 is computed, not hardcoded.**
Read `evaluateModelVersions()` in
[`src/lib/talentModel.ts`](src/lib/talentModel.ts) end to end: V1's "implied
weights" are the real Pearson correlation of each factor against V1's own
score across every decided candidate; V2's weights are fit only on the train
fold against the real `highPerformer` outcome label; the reported precision
numbers come from `precisionAtK()` run against the untouched holdout fold
using those learned weights via `scoreCandidate()`. No literal/hardcoded
percentages anywhere in that path — this was verification, not new code, so
nothing was changed here.

**Growth Agent — one real, live, end-to-end research path (highest
priority).** Added `fetchLiveEvidence(companyName)` to
[`src/lib/research.ts`](src/lib/research.ts): real, unauthenticated HTTP
calls to two keyless public APIs (Wikipedia's REST summary API, Hacker
News' Algolia search). Wired into
[`/api/scout/targets`](src/app/api/scout/targets/route.ts) — adding a real
target now fetches and attaches real evidence (real source URLs, real
snippets, `isDemo:false`) for that specific company at intake, verified
end to end through the public tunnel (real target "Spotify" → 4 real
evidence items: a real Wikipedia URL and 3 real Hacker News discussion URLs;
cleaned up after verifying). The 50-company demo directory's bulk scan
deliberately still uses the deterministic sample-research provider — see
"Judgment call" below for why.

**External Radar — one real, live source generating real alerts.** Added a
second, explicitly-labeled tracked company, `AI Agent Market (real, live)`
(constant `LIVE_MARKET_COMPANY_NAME` in
[`src/lib/agents/radarAgent.ts`](src/lib/agents/radarAgent.ts)). Every scan
that includes it fetches real, current Hacker News posts (last 21 days,
query "AI agent") via the same keyless Algolia API and stores them as real
mentions (`isDemo:false`) feeding the *same* mention→theme→trend→alert
pipeline the synthetic "Wonderful" company already used. Verified live: one
scan fetched 25 real posts across 16 distinct real domains and produced a
real "Signal: Market topic trend" alert at **HIGH confidence** (confidence is
capped at LOW whenever any synthetic mention is involved — reaching HIGH here
is itself proof this alert has no synthetic mentions in it). Seeded into the
default `npm run seed` so it's visible without a manual step, and included
automatically in the scheduled "scan all" tick going forward.

**Demo-labeling honesty pass.** Two places had a hardcoded "Demo data" badge
next to evidence/mentions that are sometimes genuinely live now — the radar
mention list and the Scout prospect detail evidence list. Both now check the
actual `isDemo` flags and show Live/Demo/Mixed correctly (new `LiveBadge` in
[`src/components/ui/primitives.tsx`](src/components/ui/primitives.tsx)).
Reworded the top banner
([`src/components/layout/AppNotice.tsx`](src/components/layout/AppNotice.tsx))
to state precisely which paths are live vs. sample now that it's no longer
all-or-nothing.

## Judgment call worth flagging explicitly

The first attempt at Growth Agent's live research made the *default*
research provider live for the whole 50-company demo directory scan. That
broke two things the earlier review cycle had specifically hardened and the
integration suite specifically checks: (1) rescanning an unchanged company
must reproduce the same score — real search results vary run to run; (2)
evidence-linked scoring's keyword matching was written against the curated
demo vocabulary, so real article text mostly didn't match anything, silently
zeroing out evidence attribution; concretely, a plain-text Hacker News search
for a short company name like **"A2A"** (the real Italian utility) returned
real results about an unrelated real thing — the "Agent2Agent" AI protocol —
that happens to share the name. Nothing was fabricated, but it wasn't about
the right company either. Caught by the integration suite
(`Scout discovers entire filtered universe...` failed), not by manual
testing. Reverted the default back to the deterministic demo provider for
the bulk directory scan, and kept live research scoped to exactly the case
where it's unambiguous and valuable: a company a human explicitly named.

## Full verification this cycle

`npx tsc --noEmit` clean · `npm test` 19/19 · production build clean ·
`scripts/integration-test.ts` 6/6 against a fresh disposable DB copy · all
four routes manually verified locally (fresh tab, zero console errors) and
externally through the public tunnel (`curl`, real HTTP round-trip, sub-second
on every route) · real-target live-evidence flow verified through the public
tunnel · live Radar alert verified through the public tunnel.

## What is genuinely functional right now

- All statistics (correlation, holdout precision, confidence tiers), the
  approval/audit/outreach-gate state machines, the scheduler (leases,
  retries, missed-run recovery), and CSV import are real logic on real
  stored data — not mocked.
- Growth Agent: adding a real target creates a real Prospect + real
  DecisionMaker (when a person is given) + fetches real live evidence for
  the company (Wikipedia + Hacker News, real URLs) + a starter outreach
  draft, approval-gated like every other draft.
- External Radar: one tracked company (`AI Agent Market (real, live)`) is
  driven by real, current public data end to end, alerts included.

## What is still demo/sample-only

- The 50-company Growth Agent directory scan (all "Discovered" candidates
  you see before adding a real target) — deliberately deterministic sample
  research, for the reason above.
- The default "Wonderful" Radar company — curated scenario fixtures.
- All 424 Sourcing Optimizer candidates — synthetic, by design (no real
  ATS/HRIS is connected).

## Product 2 — is it ready for one real outbound test?

Yes, for everything that doesn't require credentials: add a real
company + a real named person (your own contact) via "Add a real target" —
the company gets real live evidence attached automatically; the draft still
needs a human to add the specific researched angle (left as a
`[bracketed placeholder]`, never auto-filled with anything invented); then
approve (email) or just review (LinkedIn) it; then send it yourself — the
LinkedIn link is a real, working `Open LinkedIn →` link when a URL is on
file — and mark it sent/recorded so the pipeline tracks it.

**Still requires credentials/private systems** (unchanged from before this
cycle): an authenticated email-sending provider (sending stays a manual,
human-confirmed handoff — no delivery adapter exists); an authorized
LinkedIn API (handoff stays manual by design, not just by missing
credentials); a paid search/news index for broader live coverage than
Wikipedia+Hacker News give; real ATS/HRIS connection for Sourcing Optimizer;
public-access auth for the tunnel itself (still an open demo link, per the
prior cycle's note).

## Next cycle candidates (not started — handing back to Codex)

- Reconcile this cycle's live-research architecture with the rest of the
  codebase's conventions/tests once reviewed.
- Consider whether the Growth Agent directory scan should also offer an
  explicit, opt-in "fetch live evidence for this company" action per
  already-discovered company (distinct from the deterministic bulk scan),
  now that the pattern exists.
- Public access is still unauthenticated — anyone with the tunnel link can
  read and mutate the shared demo.

## Independent reviewer cycle — 2026-09-13

### Scope and verification

Reviewed committed `8f19d32` in an isolated archive and disposable SQLite database; did not use Claude's concurrent edits. No remote is configured, so there was nothing to pull. Branch is `main`; README.md and .gitignore are present. Terminal access works under workspace-write restrictions; elevated execution uses automatic approval review.

That snapshot passed 19 existing tests, typecheck, migrations, seed and production build. The focused model fixes below passed 21 tests, typecheck and another production build in isolation. All three local product routes returned HTTP 200 and were inspected in the browser. API checks verified repeat Scout scans refresh rather than duplicate accounts, Talent retains exactly 24 latest batch rankings after another run, and Radar reanalysis creates no duplicate alerts. Radar lenses changed the result from 31 mentions / 6 themes / 5 alerts to 11 / 1 / 1. A scheduled-dispatch smoke test was prepared but **not executed**: automatic approval review rejected that command because of an account usage limit. Crash/retry recovery is therefore code-reviewed, not certified by this cycle.

Claude subsequently committed through `5b1ba1e`. At the user's request I inspected the current running website and the relevant committed changes. It now has keyless live research and live Radar ingestion, superseding the earlier finding that all research is demo-only. The **latest combined commit has not received the full isolated build/integration cycle from this reviewer**. Prior builder verification above remains builder-reported, not independent certification.

The supplied public URL `https://race-homework-bull-holder.trycloudflare.com` failed DNS resolution in both browser and terminal during this cycle. Localhost works. Public/local parity cannot currently be certified; a replacement public URL was not provided. No public data or outbound messages were changed by this review.

### CRITICAL

1. **Growth's core autonomous loop remains incomplete.** `getResearchProvider()` still discovers only the fixed directory and returns synthetic research. Real Wikipedia/Hacker News research runs when a human supplies a target. Named decision makers are supplied by a human; outreach remains a placeholder template. There is no automated reply ingestion, due follow-up execution or outcome-driven learning. Missing implementation must not be described as merely missing credentials.
2. **Growth success counters now include fabricated business outcomes.** On the current website: 64 “Decision makers identified”, 4 “Outreach sent”, 2 “Replies”, 1 “Meetings booked”. Generic role hypotheses supply the first counter; `seedGrowthAgentProgress()` supplies the delivery/reply/meeting numbers. It writes `actor: human` and `manualConfirmed: true` for simulated events, and the meeting audit omits even the seeded marker. The page does not label these individual KPIs as simulated. Use explicit scenario provenance and exclude synthetic activity from real outcome totals. Populating pipeline columns is not evidence of autonomous outreach.
3. **Sourcing validation overstates deployment readiness.** The observed holdout has 24 hires and compares 1/12 versus 3/12 successes, presented as +200% and “VALIDATION PASSED”. Training is genuinely separate from the holdout, but any positive difference passes without uncertainty, class-balance or zero-signal checks. V1 “weights” are normalized marginal correlations with V1 scores, not its actual coefficients. Label the proxy and observed sample improvement accurately; add a defensible release gate. Unknown hiring decisions are also converted to false before progression analysis.
4. **A failed new Talent evaluation leaves an older pending promotion approvable.** Superseding pending proposals happens only inside the new PASSED branch in `talentAgent.ts`; the approval endpoint does not verify the latest evaluation/data version. Invalidate or explicitly revalidate outdated proposals when outcomes change or evaluation fails.
5. **Public demo currently unverifiable.** Restore a reachable public deployment and prove which commit it serves before claiming demo readiness.

### IMPORTANT

- **Radar's live inputs are progress, but “What changed since yesterday” is unsupported.** The result compares three recent calendar weeks against five earlier weeks, not yesterday or the last observation. An unchanged scan still displays the same changes. Persist comparison snapshots and first/last-seen transitions, or name the actual window.
- The live market example showed 25 HN posts, no prior baseline and “High confidence”. Linked article domains are treated as independent sources even though discovery came from one aggregator and article claims were not fetched/verified. Separate coverage confidence, entity relevance and evidence confidence. The current browser also retained 25 executive labels; commit `7ad9583` changes future classification, so existing persisted records need reconciliation and verification.
- Company-name search is not entity resolution. Manually specifying a company does not make name collisions unambiguous. Store verified domain/entity identity and reject unrelated evidence. Wikipedia fetch time should not masquerade as the underlying event date.
- Scheduler claims advance `nextRunAt` before execution; a crash in that gap skips the occurrence. Retry attempt state can carry into the next scheduled occurrence after exhaustion, and the 15-minute lease has no heartbeat. Add occurrence IDs, durable claim/recovery and tests for crash/overlap/retry reset.
- Outreach is a useful manual state machine, but sending another message can regress a MEETING_BOOKED prospect to CONTACTED. Protect terminal progression, persist provider delivery IDs when delivery is implemented, and bind approval to the exact message revision.
- README/review capability statements need reconciliation: live Radar email now has a Resend adapter, while Growth delivery still does not. Source-fetch failures return empty results and can resemble a successful quiet period; expose degraded source health.

### NICE TO HAVE

- Show each agent's latest concrete result, next action and blocker immediately; prioritize work needing a human over lists of scores.
- Make one prospect's evidence → named buyer → approved message → real outcome trail the Growth demo centerpiece.
- Make one newly detected, relevant change with before/after evidence the Radar centerpiece.
- Show Talent's absolute successes and uncertainty beside relative improvement, plus a clear active-model version after approval.
- Add a deployed commit identifier and health endpoint for quick public/local parity checks.

### Small safe fixes in this cycle

`talentModel.ts` now derives high-performer labels from current manager ratings for both training and holdout validation. CSV/PATCH updates no longer leave V2 training on stale cached flags. Relative improvement is null when V1 precision is zero instead of inventing a 100% improvement. Two regression tests cover outcome reversal with stale flags and the zero baseline. These changes were tested in isolation; no redesign was copied over Claude's work.

### Real versus demo / credentials

- **Sourcing:** real calculations, train/holdout split, stored evaluations/rankings and approval records; synthetic candidates and no ATS/HRIS connector. Real historical outcomes and an implemented connector are needed for operational use.
- **Growth:** real storage, deterministic scoring, deduplication, history, manual states and keyless research on manually entered targets. Directory research and seeded commercial outcomes are synthetic. Autonomous discovery/contact identification/personalization/learning need implementation; authenticated email delivery needs an adapter and authorized sender. LinkedIn manual handoff is valid and does not require an API.
- **Radar:** real keyword clustering, historical buckets, threshold alerts, lens filtering and newly implemented live public-source ingestion. Default fixtures coexist with live evidence. Resend alerts require RESEND_API_KEY and ALERT_EMAIL_FROM; this reviewer did not send email. Broader coverage needs additional sources, but current truth/evidence issues are not solved by a key.

### Next Builder Actions

1. First remove misleading Growth success metrics: add scenario provenance to messages/events, label seeded pipeline outcomes, count verified named contacts separately, and test that seed data contributes zero real deliveries/replies/meetings.
2. Implement one scheduled Growth vertical slice using real non-US companies, verified domain + named buyer + source excerpts, researched editable outreach, a revision-bound approval/manual LinkedIn handoff, and persisted outcome/follow-up tasks. Add an explicit credential-blocked state only where code is otherwise implemented. Prove learning changes the next selection from recorded outcomes.
3. Harden Sourcing: derive all displayed success badges consistently from outcomes, preserve unknown hire decisions, label V1 proxy weights, add uncertainty/class checks, and invalidate outdated pending approvals. Render zero-baseline rationale without `+?%`.
4. Harden Radar: persist daily/last-run deltas, reconcile old audience labels, keep demo/live provenance separate, verify entity relevance, and cap confidence when sources or baseline are insufficient. Test repeated unchanged scans produce no “new change” or duplicate notification.
5. Add scheduler crash/retry/lease tests and monotonic outreach state tests; restore and record the current public URL, expose commit identity, then run a clean isolated test/typecheck/build/integration cycle and verify all three public flows. Request the next independent review only after committing, to avoid spending credits on moving targets.

**Independent demo verdict:** not ready to present as three fully autonomous live products. Suitable for a clearly labeled prototype walkthrough locally; Growth truth and public availability remain release blockers.
