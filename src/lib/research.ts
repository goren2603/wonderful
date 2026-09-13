// Web research abstraction shared by Company Scout and External Radar.
//
// The 50-company demo directory scan (getResearchProvider, used by the
// scheduled/bulk scan) stays on the deterministic DemoResearchProvider —
// this is deliberate, not a limitation to hide. A live web search returns
// different results second to second (new posts, rate limits), which broke
// the scan's own determinism guarantees (rescanning an unchanged company
// must reproduce the same score, verified by the integration suite) and its
// evidence-linked scoring (written against curated demo vocabulary; real
// article text doesn't reliably contain those keywords, and — concretely —
// a plain-text search for a short company name like "A2A" can return real
// results about something unrelated that happens to share the name, e.g.
// the Agent2Agent AI protocol instead of the Italian utility).
//
// fetchLiveEvidence() below is the one real, live path: it performs genuine
// unauthenticated HTTP calls to two public, keyless APIs (Wikipedia's REST
// summary API and the Hacker News Algolia search API) — no API key is
// configured or required. It is used specifically for a real target a human
// operator adds by name (see /api/scout/targets) — exactly the case where
// "real, live research" is the right claim, without destabilizing the demo
// directory's determinism. Hacker News search is skipped for very short
// company names (<=4 chars) since name-collision risk there is too high to
// be useful evidence.
//
// Ground rule enforced everywhere in this file and its seed data: never
// invent a specific citation URL. Live evidence links to the exact page
// fetched; demo evidence always links to a real, verifiable top-level domain
// (a company's own homepage, or a real platform's homepage like
// glassdoor.com) and is always flagged isDemo=true so the UI can label it
// plainly.

export interface EvidenceItem {
  sourceUrl: string;
  sourceName: string;
  sourceDate: Date;
  title: string;
  snippet: string;
  confidence: number; // 0..1
  isDemo: boolean;
}

import { SEED_COMPANIES, SIGNAL_LIBRARY, type Country, type Vertical, type SeedCompany } from "./seedData/prospects";

export interface ResearchProvider {
  name: "demo" | "live";
  isConfigured(): boolean;
  discover(countries: Country[], verticals: Vertical[]): Promise<SeedCompany[]>;
  research(company: SeedCompany): Promise<EvidenceItem[]>;
}

class DemoResearchProvider implements ResearchProvider {
  name = "demo" as const;
  isConfigured(): boolean {
    return true;
  }
  async discover(countries: Country[], verticals: Vertical[]) {
    return SEED_COMPANIES.filter(c=>countries.includes(c.country)&&verticals.includes(c.vertical));
  }
  async research(company: SeedCompany): Promise<EvidenceItem[]> {
    return SIGNAL_LIBRARY[company.vertical].map((snippet,i)=>({sourceUrl:company.website,sourceName:`${company.name} — sample scenario`,sourceDate:new Date("2026-09-13T00:00:00Z"),title:`Illustrative sector signal ${i+1}`,snippet,confidence:0,isDemo:true}));
  }
}

export function getResearchProvider(): ResearchProvider {
  return new DemoResearchProvider();
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "User-Agent": "wonderful-intelligence-demo/1.0 (research prototype)" } });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

async function fetchWikipediaSummary(companyName: string): Promise<EvidenceItem | null> {
  const title = companyName.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const res = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, 8000);
  if (!res) return null;
  const data = await res.json().catch(() => null);
  const pageUrl = data?.content_urls?.desktop?.page;
  if (!data || data.type === "disambiguation" || !data.extract || !pageUrl) return null;
  return {
    sourceUrl: pageUrl,
    sourceName: "Wikipedia",
    sourceDate: new Date(),
    title: data.title ?? companyName,
    snippet: String(data.extract).slice(0, 500),
    confidence: 0.55,
    isDemo: false,
  };
}

async function fetchHackerNewsMentions(companyName: string): Promise<EvidenceItem[]> {
  if (companyName.replace(/[^A-Za-z0-9]/g, "").length <= 4) return []; // short/acronym names collide with unrelated real results too often
  const res = await fetchWithTimeout(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(companyName)}&tags=story&hitsPerPage=3`, 8000);
  if (!res) return [];
  const data = await res.json().catch(() => null);
  const hits: unknown[] = Array.isArray(data?.hits) ? data.hits : [];
  const items: EvidenceItem[] = [];
  for (const raw of hits) {
    const hit = raw as { title?: string; url?: string; created_at?: string; points?: number; num_comments?: number; objectID?: string };
    if (!hit.title || !hit.created_at) continue;
    const discussionUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    items.push({
      sourceUrl: hit.url || discussionUrl,
      sourceName: "Hacker News",
      sourceDate: new Date(hit.created_at),
      title: hit.title,
      snippet: `Publicly discussed on Hacker News: "${hit.title}" (${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments). Discussion thread: ${discussionUrl}. Verify this is actually about the company in question before relying on it — a plain-text name search can also surface an unrelated real result that happens to share the name.`,
      confidence: 0.35,
      isDemo: false,
    });
  }
  return items;
}

/**
 * Real, live, keyless research for ONE explicitly named company — used when
 * a human operator adds a real target (see /api/scout/targets), not by the
 * demo directory's bulk scan. May return an empty array if neither live
 * source has anything for this name; callers should treat that as "no live
 * evidence found," not as an error.
 */
export async function fetchLiveEvidence(companyName: string): Promise<EvidenceItem[]> {
  const [wiki, hn] = await Promise.all([fetchWikipediaSummary(companyName), fetchHackerNewsMentions(companyName)]);
  return [wiki, ...hn].filter((x): x is EvidenceItem => x !== null);
}

// Capability status is about implemented behavior, never merely the presence of a key.
export function researchStatus() {
  return {
    provider: "demo",
    liveAvailable: true,
    warning:
      "The 50-company demo directory scan always uses curated sample research (isDemo=true), kept deterministic on purpose. Adding a real target fetches real, live evidence from two keyless public APIs (Wikipedia, Hacker News) instead — coverage is uneven, short/acronym company names skip Hacker News to avoid name collisions with unrelated real results, and nothing here is a paid search/news index.",
  };
}
