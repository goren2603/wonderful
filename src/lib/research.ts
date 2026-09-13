// Web research abstraction shared by Company Scout and External Radar.
//
// There is no live search/news API key configured in this environment, so the
// default provider is a demo provider backed by curated seed data. It is
// designed so a real provider (Serper, Bing News, NewsAPI, etc.) can be
// dropped in later behind the same interface — see LiveSearchProvider below.
//
// Ground rule enforced everywhere in this file and its seed data: never
// invent a specific citation URL (a fake article/review permalink). Demo
// evidence always links to a real, verifiable top-level domain (a company's
// own homepage, or a real platform's homepage like glassdoor.com) and is
// always flagged isDemo=true so the UI can label it plainly.

export interface EvidenceItem {
  sourceUrl: string;
  sourceName: string;
  sourceDate: Date;
  title: string;
  snippet: string;
  confidence: number; // 0..1
  isDemo: boolean;
}

export interface ResearchProvider {
  name: "demo" | "live";
  isConfigured(): boolean;
}

class DemoResearchProvider implements ResearchProvider {
  name = "demo" as const;
  isConfigured(): boolean {
    return true;
  }
}

class LiveSearchProvider implements ResearchProvider {
  name = "live" as const;
  private apiKey?: string;
  constructor() {
    this.apiKey = process.env.SEARCH_PROVIDER_API_KEY;
  }
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
  // Intentionally unimplemented until a real search API key is configured.
  // Wire this up to your provider of choice (Serper/Bing/NewsAPI) — the rest
  // of the app only depends on EvidenceItem[], so nothing else changes.
}

export function getResearchProvider(): ResearchProvider {
  const live = new LiveSearchProvider();
  if (live.isConfigured()) return live;
  return new DemoResearchProvider();
}
