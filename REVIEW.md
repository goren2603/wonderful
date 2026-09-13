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
