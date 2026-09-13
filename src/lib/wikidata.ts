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

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "wonderful-intelligence-demo/1.0 (research prototype)" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function findCompanyEntityId(companyName: string): Promise<string | null> {
  const data = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(companyName)}&language=en&format=json&limit=6`);
  const results: { id: string; description?: string }[] = data?.search ?? [];
  if (results.length === 0) return null;
  // Prefer a result whose description reads like a business; reject ones
  // that clearly aren't (a newspaper, a sculpture, a given name, ...).
  const business = results.find((r) => r.description && COMPANY_HINTS.test(r.description) && !NON_COMPANY_HINTS.test(r.description));
  if (business) return business.id;
  // Otherwise take the first candidate that isn't obviously wrong — still
  // better than nothing for a company name with a sparse Wikidata footprint.
  const plausible = results.find((r) => !r.description || !NON_COMPANY_HINTS.test(r.description));
  return plausible?.id ?? null;
}

async function resolvePersonLabel(personId: string): Promise<string | null> {
  const data = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${personId}&props=labels&languages=en&format=json`);
  return data?.entities?.[personId]?.labels?.en?.value ?? null;
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

export async function findVerifiedExecutive(companyName: string): Promise<VerifiedExecutive | null> {
  const entityId = await findCompanyEntityId(companyName);
  if (!entityId) return null;
  const data = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`);
  const claims = data?.entities?.[entityId]?.claims;
  if (!claims) return null;
  const ceoId = selectCurrentPersonId(claims.P169 ?? []);
  const directorId = selectCurrentPersonId(claims.P1037 ?? []);
  const personId = ceoId ?? directorId;
  if (!personId) return null;
  const name = await resolvePersonLabel(personId);
  if (!name) return null;
  return {
    name,
    role: ceoId ? "Chief Executive Officer" : "Director / Manager",
    sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
    personSourceUrl: `https://www.wikidata.org/wiki/${personId}`,
  };
}
