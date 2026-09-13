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

// Capability status is about implemented behavior, never merely the presence of a key.
export function researchStatus() {
  return { provider: "demo", liveAvailable: false, warning: "Curated sample research only. A search API adapter and source verification are not implemented; setting a key alone does not enable live research." };
}
