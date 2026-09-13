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

export async function findVerifiedExecutive(companyName: string): Promise<VerifiedExecutive | null> {
  const entityId = await findCompanyEntityId(companyName);
  if (!entityId) return null;
  const data = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`);
  const claims = data?.entities?.[entityId]?.claims;
  if (!claims) return null;
  const ceoClaim = claims.P169?.[0]?.mainsnak?.datavalue?.value?.id as string | undefined;
  const directorClaim = claims.P1037?.[0]?.mainsnak?.datavalue?.value?.id as string | undefined;
  const personId = ceoClaim ?? directorClaim;
  if (!personId) return null;
  const name = await resolvePersonLabel(personId);
  if (!name) return null;
  return {
    name,
    role: ceoClaim ? "Chief Executive Officer" : "Director / Manager",
    sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
    personSourceUrl: `https://www.wikidata.org/wiki/${personId}`,
  };
}
