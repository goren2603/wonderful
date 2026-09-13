import type { SeedCompany } from "./seedData/prospects";
import type { ScoreComponent } from "./types";

export interface ScoringEvidence { id: string; snippet: string; isDemo: boolean }
/** Rules v2: explicit sector prior + headcount bands + matching evidence. No random inputs. */
export function scoreCompany(company: SeedCompany, evidence: ScoringEvidence[]) {
  const match = (re: RegExp) => evidence.filter(e => re.test(e.snippet));
  const component = (label:string,max:number,items:ScoringEvidence[],points:number,rule:string):ScoreComponent => ({label,max,score:Math.min(max,items.length*points),why:`${rule} ${items.length} matching evidence item(s). ${items.some(e=>e.isDemo)?"Illustrative input; not verified company facts.":""}`,evidenceIds:items.map(e=>e.id)});
  const headcount = Number(company.employeeCountEstimate.replace(/[^0-9]/g,"")) || 0;
  const scale = headcount>=100000?20:headcount>=50000?18:headcount>=15000?15:headcount>=5000?12:headcount>0?8:0;
  const sector = {Telecommunications:10,Healthcare:8,Retail:9,"Financial Services":8,Utilities:9}[company.vertical] ?? 0;
  const pain = component("Operational pain",25,match(/strain|complex|legacy|overhead|spike|high.volume|billing/i),5,"5 points per operational constraint, plus documented sector-fit prior.");
  pain.score=Math.min(25,pain.score+sector); pain.why+=` Sector prior: ${company.vertical}=${sector}/10 (workflow fit assumption).`;
  const breakdown:ScoreComponent[] = [pain,
    {label:"Company scale",max:20,score:scale,why:`Unverified directory estimate ${company.employeeCountEstimate}. Bands: 100k+=20, 50k+=18, 15k+=15, 5k+=12, smaller=8, unknown=0.`,evidenceIds:[]},
    component("AI readiness",20,match(/\bAI\b|automat|digital|moderniz/i),10,"10 points per digital-investment signal, capped at 20."),
    component("Multilingual complexity",15,match(/multilingual|language|multiple countries|jurisdiction|regions/i),7.5,"7.5 points per cross-market signal; country alone does not prove language complexity."),
    component("Urgency / growth",15,match(/recent|expan|growth|reorganiz|acquisition|seasonal/i),7.5,"7.5 points per change signal, capped at 15."),
    component("Executive accessibility",5,match(/named decision.maker|verified contact/i),5,"5 points for a verified named buying contact; a generic role earns zero."),
  ];
  return {score:breakdown.reduce((s,b)=>s+b.score,0),breakdown};
}
export function dedupeCompany(name:string,country:string) {return `${name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ")}::${country.trim().toLowerCase()}`;}

/**
 * Maps the underlying (unchanged) Prospect.status state machine onto the
 * six-stage Growth Agent pipeline shown in the UI. QUALIFIED is derived from
 * score, not stored separately, so "qualifies" always reflects the current
 * opportunity score rather than a snapshot taken at scoring time.
 */
export const QUALIFIED_THRESHOLD = 60;
export function pipelineStage(prospect: { status: string; opportunityScore: number }): "DISCOVERED" | "QUALIFIED" | "OUTREACH_READY" | "CONTACTED" | "REPLIED" | "MEETING_BOOKED" {
  if (prospect.status === "MEETING_BOOKED") return "MEETING_BOOKED";
  if (prospect.status === "REPLIED") return "REPLIED";
  if (prospect.status === "CONTACTED") return "CONTACTED";
  if (prospect.status === "OUTREACH_READY") return "OUTREACH_READY";
  return prospect.opportunityScore >= QUALIFIED_THRESHOLD ? "QUALIFIED" : "DISCOVERED";
}
