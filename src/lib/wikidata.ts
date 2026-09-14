// Real, keyless, structured lookup for "who runs this company" via
// Wikidata's public API — not full-text search, so it doesn't have the
// keyword-collision problem plain search does (see research.ts's short-name
// guard for that problem). Wikidata entities carry a real, dated, sourced
// claim (P169 chief executive officer, or P1037 director/manager as a
// fallback) that links back to a specific, checkable Wikidata page — this is
// what "a source that verifies them" means here. Returns null at every step
// where nothing solid was found; callers must treat null as "no verified
// contact found," never fill it in with a guess.

export interface VerifiedExecutive {
  name: string;
  role: "Chief Executive Officer" | "Director / Manager";
  sourceUrl: string; // the Wikidata entity page for the company, where the claim lives
  personSourceUrl: string; // the Wikidata entity page for the person
}

const NON_COMPANY_HINTS = /\b(newspaper|sculpture|film|album|song|surname|given name|village|river|mountain|novel|magazine|journal|television series|video game|painting|disambiguation)\b/i;
const COMPANY_HINTS = /\b(company|corporation|multinational|retailer|retail|manufacturer|bank|insurer|insurance|telecom|telecommunications|utility|holding|group|conglomerate|business|firm|brand|enterprise|airline|healthcare provider)\b/i;

// Distinguishes "asked Wikidata and it genuinely had nothing" from "the
// request itself failed" (timeout/network/HTTP error/rate limit) — callers
// must NOT treat the latter as "not currently holding the role" (see the
// findVerifiedExecutiveDetailed doc comment for why this matters).
async function fetchJson(url: string): Promise<{ data: any | null; error: string | null }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "wonderful-intelligence-demo/1.0 (research prototype)" } });
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function findCompanyEntityId(companyName: string): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(companyName)}&language=en&format=json&limit=6`);
  if (error) return { id: null, error };
  const results: { id: string; description?: string }[] = data?.search ?? [];
  if (results.length === 0) return { id: null, error: null };
  // Prefer a result whose description reads like a business; reject ones
  // that clearly aren't (a newspaper, a sculpture, a given name, ...).
  const business = results.find((r) => r.description && COMPANY_HINTS.test(r.description) && !NON_COMPANY_HINTS.test(r.description));
  if (business) return { id: business.id, error: null };
  // Otherwise take the first candidate that isn't obviously wrong — still
  // better than nothing for a company name with a sparse Wikidata footprint.
  const plausible = results.find((r) => !r.description || !NON_COMPANY_HINTS.test(r.description));
  return { id: plausible?.id ?? null, error: null };
}

async function resolvePersonLabel(personId: string): Promise<{ name: string | null; error: string | null }> {
  const { data, error } = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${personId}&props=labels&languages=en&format=json`);
  if (error) return { name: null, error };
  return { name: data?.entities?.[personId]?.labels?.en?.value ?? null, error: null };
}

interface WikidataClaim {
  mainsnak?: { datavalue?: { value?: { id?: string } } };
  rank?: "preferred" | "normal" | "deprecated";
  qualifiers?: { P582?: unknown[] }; // P582 = end time
}

/**
 * A company can have many people who have held a role (P169 CEO, P1037
 * director) over time — taking claims[0] picks whichever Wikidata happened
 * to list first, which is NOT necessarily the current holder (concretely:
 * ABN AMRO's P169 claims list its 2009-2017 CEO first). This selects the
 * one claim that's actually still current:
 *  - drop deprecated-rank claims entirely
 *  - a "preferred"-rank claim (Wikidata's own way of marking the current
 *    one when several exist) with no end-date qualifier wins outright
 *  - otherwise, if exactly ONE remaining claim has no P582 (end time), it's
 *    unambiguous — use it
 *  - any other case (zero such claims, or more than one, and none marked
 *    preferred) is genuinely ambiguous — return null rather than guess.
 */
function selectCurrentPersonId(claims: WikidataClaim[]): string | null {
  const usable = claims.filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue?.value?.id);
  const preferredCurrent = usable.find((c) => c.rank === "preferred" && !c.qualifiers?.P582);
  if (preferredCurrent) return preferredCurrent.mainsnak!.datavalue!.value!.id!;
  const noEndDate = usable.filter((c) => !c.qualifiers?.P582);
  if (noEndDate.length === 1) return noEndDate[0].mainsnak!.datavalue!.value!.id!;
  return null; // ambiguous or all historical — don't guess
}

/**
 * Real-error-aware version: `error` set means the lookup could not actually
 * be completed this run (timeout/rate-limit/network) — a caller reconciling
 * a previously-saved contact against a fresh check MUST treat that as
 * "inconclusive, skip reconciliation this run," never as "role no longer
 * current." Concretely: a rate-limited request must never be allowed to
 * delete a still-correct, previously-verified contact. `exec: null` with
 * `error: null` is the only case that means "genuinely checked, no current
 * holder found."
 */
export async function findVerifiedExecutiveDetailed(companyName: string): Promise<{ exec: VerifiedExecutive | null; error: string | null }> {
  const { id: entityId, error: searchError } = await findCompanyEntityId(companyName);
  if (searchError) return { exec: null, error: searchError };
  if (!entityId) return { exec: null, error: null };
  const { data, error: entityError } = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`);
  if (entityError) return { exec: null, error: entityError };
  const claims = data?.entities?.[entityId]?.claims;
  if (!claims) return { exec: null, error: null };
  const ceoId = selectCurrentPersonId(claims.P169 ?? []);
  const directorId = selectCurrentPersonId(claims.P1037 ?? []);
  const personId = ceoId ?? directorId;
  if (!personId) return { exec: null, error: null };
  const { name, error: labelError } = await resolvePersonLabel(personId);
  if (labelError) return { exec: null, error: labelError };
  if (!name) return { exec: null, error: null };
  return {
    exec: {
      name,
      role: ceoId ? "Chief Executive Officer" : "Director / Manager",
      sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
      personSourceUrl: `https://www.wikidata.org/wiki/${personId}`,
    },
    error: null,
  };
}

/** Convenience wrapper for callers that don't need to distinguish "not found" from "lookup failed" (e.g. Growth Agent's first-time discovery, where either way the honest result is "no verified contact yet"). */
export async function findVerifiedExecutive(companyName: string): Promise<VerifiedExecutive | null> {
  const { exec } = await findVerifiedExecutiveDetailed(companyName);
  return exec;
}
