import { db } from '@/lib/db';
import { getResearchProvider, fetchLiveEvidenceDetailed, excludeSecurityIncidents } from '@/lib/research';
import { findVerifiedExecutive } from '@/lib/wikidata';
import { withAgentLease, retry } from '@/lib/agentRuntime';
import { scoreCompany, scoreLiveCompany, dedupeCompany } from '@/lib/scoutScoring';
import { COUNTRIES, VERTICALS, SEED_COMPANIES, USE_CASE_BY_VERTICAL, DECISION_MAKER_TITLES_BY_VERTICAL, type Country, type Vertical, type SeedCompany } from '@/lib/seedData/prospects';
import type { AgentStep } from '@/lib/types';
// Sample-scenario scan: curated, deterministic illustrative evidence — not
// run automatically anymore (see runLiveGrowthDiscovery below, which is the
// default scheduled/seeded path). Kept as an explicit "Load sample scenario"
// action so the clustering/scoring/approval mechanics stay demonstrable even
// where live sources have nothing. Every prospect it creates is tagged
// discoveryMode:"demo" — never mixed with real, live-discovered accounts.
export interface ScoutScanParams { countries: Country[]; verticals: Vertical[]; limit?: number }
export async function runCompanyScoutScan(params: ScoutScanParams) {
  if (!Array.isArray(params.countries) || !params.countries.length || params.countries.some(c=>!COUNTRIES.includes(c)) || !Array.isArray(params.verticals) || !params.verticals.length || params.verticals.some(v=>!VERTICALS.includes(v)) || !Number.isInteger(params.limit??12) || (params.limit??12)<1 || (params.limit??12)>50) throw new Error('Invalid scan scope: choose supported countries/sectors and limit 1–50');
  return withAgentLease('COMPANY_SCOUT', async()=>{
    const provider=getResearchProvider();
    const run=await db.agentRun.create({data:{agent:'COMPANY_SCOUT',goal:`Scan ${params.countries.join(', ')} / ${params.verticals.join(', ')}`}});
    const steps:AgentStep[]=[];
    const step=async(label:string,detail:string)=>{steps.push({label,detail,at:new Date().toISOString()});await db.agentRun.update({where:{id:run.id},data:{stepsJson:JSON.stringify(steps)}});};
    let sourcesChecked=0,entitiesAccepted=0,actionsCreated=0,refreshed=0;
    try {
      await step('Discovering',`Using ${provider.name} directory. Countries and sectors are actual discovery filters.`);
      const universe=await retry(()=>provider.discover(params.countries,params.verticals));
      const tracked=await db.prospect.findMany({where:{discoveryMode:'demo'}});
      // New companies first, then least recently researched. Repeated scans advance through the universe.
      // Scoped to discoveryMode:'demo' so this never collides with (or gets
      // confused for) a real, live-discovered account for the same company.
      const existingFor=(c:typeof universe[number])=>tracked.find(p=>dedupeCompany(p.companyName,p.country)===dedupeCompany(c.name,c.country));
      const candidates=universe.sort((a,b)=>(existingFor(a)?.lastUpdatedAt.getTime()??0)-(existingFor(b)?.lastUpdatedAt.getTime()??0)||a.name.localeCompare(b.name)).slice(0,params.limit??12);
      for(const company of candidates) {
        await step('Researching',`${company.name}: obtaining illustrative evidence from ${provider.name} provider; no web pages fetched in demo mode.`);
        const items=await retry(()=>provider.research(company));
        sourcesChecked+=items.length;
        const existing=existingFor(company);
        await db.$transaction(async tx=>{
          const prospect=existing??await tx.prospect.create({data:{companyName:company.name,dedupeKey:`demo::${dedupeCompany(company.name,company.country)}`,country:company.country,vertical:company.vertical,website:company.website,employeeCountEstimate:company.employeeCountEstimate,runId:run.id,discoveryMode:'demo'}});
          const evidence=[];
          for(const item of items) {
            const previous=await tx.evidence.findFirst({where:{entityType:'PROSPECT',entityId:prospect.id,sourceUrl:item.sourceUrl,snippet:item.snippet}});
            evidence.push(previous??await tx.evidence.create({data:{...item,entityType:'PROSPECT',entityId:prospect.id,provider:provider.name}}));
          }
          const {score,breakdown}=scoreCompany(company,evidence);
          const useCase=USE_CASE_BY_VERTICAL[company.vertical];
          await tx.prospect.update({where:{id:prospect.id},data:{opportunityScore:score,scoreBreakdownJson:JSON.stringify(breakdown),useCase:useCase.useCase,useCaseRationale:useCase.rationale,status:existing?.status==='NEW'?'SCORED':existing?.status??'SCORED',whyJson:JSON.stringify([`${company.employeeCountEstimate} unverified directory headcount in ${company.country}.`,`${company.vertical} workflow-fit prior; validate the actual operating model.`,`${score}/100 from scoring rules v2 and ${evidence.length} illustrative evidence items.`]),runId:run.id}});
          await tx.scoreHistory.create({data:{prospectId:prospect.id,score,breakdownJson:JSON.stringify(breakdown)}});
          // Repair early demo drafts that asserted unsupported research. Never overwrite approved/sent text.
          const drafts=await tx.outreachMessage.findMany({where:{prospectId:prospect.id,status:{in:['DRAFT','AWAITING_APPROVAL']}}});
          for(const draft of drafts) {
            if(draft.body.includes("I've been following")||draft.body.includes('noticed ')) {
              const body=`Hi {{decision_maker_first_name}},\n\nIs ${useCase.useCase.toLowerCase()} a priority at ${company.name}? We would welcome a conversation about where Wonderful might help.\n\n{{sender_name}}`;
              await tx.outreachMessage.update({where:{id:draft.id},data:{body,angle:'Workflow-fit hypothesis; company pain points remain unverified.'}});
              await tx.auditLogEntry.create({data:{actor:'agent',action:'unsupported_draft_revised',entityType:'OutreachMessage',entityId:draft.id,detailJson:JSON.stringify({runId:run.id,before:draft.body,after:body})}});
            }
            if(draft.status==='AWAITING_APPROVAL'&&!await tx.approvalItem.findFirst({where:{entityId:draft.id,status:'PENDING'}})) await tx.approvalItem.create({data:{kind:'OUTREACH_EMAIL',entityType:'OutreachMessage',entityId:draft.id,title:`Review draft for ${company.name}`,payloadJson:JSON.stringify(draft)}});
          }
          if(!existing) {
            const makers=[];
            for(const title of DECISION_MAKER_TITLES_BY_VERTICAL[company.vertical].slice(0,2)) makers.push(await tx.decisionMaker.create({data:{prospectId:prospect.id,name:'Unverified buying-role hypothesis',title,confidence:0,whyThisPerson:`${title} typically owns ${useCase.useCase.toLowerCase()} decisions at a company this size; no named individual has been verified yet.`}}));
            const primary=makers[0];
            const angle=`Explore whether ${useCase.useCase.toLowerCase()} is a priority at ${company.name}; the scenario is not verified research.`;
            const body=`Hi {{decision_maker_first_name}},\n\nI work with enterprise teams exploring AI-assisted ${useCase.useCase.toLowerCase()}. Is this an operational priority for ${company.name}?\n\nIf useful, we could compare your current workflow and discuss where Wonderful might help.\n\nOpen to a short conversation?\n\n{{sender_name}}`;
            const email=await tx.outreachMessage.create({data:{prospectId:prospect.id,decisionMakerId:primary?.id,channel:'EMAIL',subject:`Exploring ${useCase.useCase.split(' / ')[0].toLowerCase()} at ${company.name}`,body,angle,status:'AWAITING_APPROVAL'}});
            await tx.approvalItem.create({data:{kind:'OUTREACH_EMAIL',entityType:'OutreachMessage',entityId:email.id,title:`Review draft for ${company.name} (does not send)`,payloadJson:JSON.stringify(email)}});
            await tx.outreachMessage.create({data:{prospectId:prospect.id,decisionMakerId:primary?.id,channel:'LINKEDIN',body,angle,status:'DRAFT'}});
          }
          await tx.auditLogEntry.create({data:{actor:'agent',action:existing?'prospect_rescored':'prospect_discovered',entityType:'Prospect',entityId:prospect.id,detailJson:JSON.stringify({runId:run.id,score,provider:provider.name,evidenceIds:evidence.map(e=>e.id)})}});
        },{timeout:15000});
        if(existing) refreshed++; else entitiesAccepted++;
        actionsCreated+=existing?1:3;
        await step('Scoring',`${company.name}: saved evidence-linked rules and a new score-history snapshot.${existing?' Existing outreach and human state preserved.':' Buying-role hypotheses and approval-gated drafts saved.'}`);
      }
      const summary=`${provider.name==='demo'?'Demo directory':'Research'}: ${candidates.length} companies evaluated, ${entitiesAccepted} new, ${refreshed} refreshed. ${sourcesChecked} evidence items examined; ${provider.name==='demo'?'0 web pages fetched.':'See evidence URLs.'}`;
      await db.agentRun.update({where:{id:run.id},data:{status:'SUCCEEDED',endedAt:new Date(),durationMs:Date.now()-run.startedAt.getTime(),sourcesChecked,entitiesFound:candidates.length,entitiesAccepted,actionsCreated,summary,warningsJson:JSON.stringify(provider.name==='demo'?['Synthetic evidence; scores represent scenario fit, not verified opportunity. Live discovery and contact enrichment require implemented adapters.']:[]),stepsJson:JSON.stringify(steps)}});
      return {runId:run.id,entitiesFound:candidates.length,entitiesAccepted,actionsCreated,refreshed};
    } catch(err) {
      await db.agentRun.update({where:{id:run.id},data:{status:'FAILED',endedAt:new Date(),durationMs:Date.now()-run.startedAt.getTime(),errorMessage:err instanceof Error?err.message:String(err),stepsJson:JSON.stringify(steps)}});throw err;
    }
  });
}

// The default, real path: real named companies (the same real-company
// universe as the sample scenario — the names/countries were always real,
// only the "research" attached to them was canned before), real live
// evidence (Wikipedia + Hacker News), and a real, sourced, structured
// executive lookup (Wikidata — see src/lib/wikidata.ts) instead of the old
// "role hypothesis" guess. When no verified executive is found, no outreach
// draft is created at all — the UI shows "no verified contact found"
// honestly rather than a placeholder. Every prospect here is tagged
// discoveryMode:"live", entirely separate from the demo scenario.
export interface LiveDiscoveryParams { countries?: Country[]; verticals?: Vertical[]; limit?: number }
export async function runLiveGrowthDiscovery(params: LiveDiscoveryParams = {}) {
  const countries = params.countries?.length ? params.countries : COUNTRIES;
  const verticals = params.verticals?.length ? params.verticals : VERTICALS;
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 20); // bounded: each company costs 2-3 real HTTP round trips
  return withAgentLease('COMPANY_SCOUT', async () => {
    const run = await db.agentRun.create({ data: { agent: 'COMPANY_SCOUT', goal: `Live discovery: real evidence + verified contacts, ${countries.join(', ')} / ${verticals.join(', ')}` } });
    const steps: AgentStep[] = [];
    const step = async (label: string, detail: string) => { steps.push({ label, detail, at: new Date().toISOString() }); await db.agentRun.update({ where: { id: run.id }, data: { stepsJson: JSON.stringify(steps) } }); };
    let sourcesChecked = 0, entitiesAccepted = 0, actionsCreated = 0, refreshed = 0, verifiedContacts = 0, sourceErrorCount = 0;
    try {
      const universe: SeedCompany[] = SEED_COMPANIES.filter(c => countries.includes(c.country) && verticals.includes(c.vertical));
      const tracked = await db.prospect.findMany({ where: { discoveryMode: 'live' } });
      const existingFor = (c: SeedCompany) => tracked.find(p => dedupeCompany(p.companyName, p.country) === dedupeCompany(c.name, c.country));
      const candidates = universe.sort((a, b) => (existingFor(a)?.lastUpdatedAt.getTime() ?? 0) - (existingFor(b)?.lastUpdatedAt.getTime() ?? 0) || a.name.localeCompare(b.name)).slice(0, limit);
      await step('Discovering', `${candidates.length} real companies selected from ${universe.length} in scope (least-recently-checked first — a real ongoing queue, not a one-shot list).`);
      for (const company of candidates) {
        const { items: fetchedItems, sourceErrors } = await fetchLiveEvidenceDetailed(company.name);
        const items = excludeSecurityIncidents(fetchedItems); // a sales lead's evidence panel shouldn't read as "we noticed you got hacked"
        sourcesChecked += items.length;
        if (sourceErrors.length) { sourceErrorCount++; await step('Source error', `${company.name}: ${sourceErrors.join('; ')} — treat "no evidence" below as inconclusive for this company, not a confirmed negative.`); }
        else await step('Researching', `${company.name}: ${items.length} real evidence item(s) found (Wikipedia, Hacker News).`);
        const exec = await findVerifiedExecutive(company.name);
        if (exec) verifiedContacts++;
        await step('Verifying contact', `${company.name}: ${exec ? `${exec.name} (${exec.role}) — verified via a structured Wikidata claim.` : 'no verified executive contact found on Wikidata.'}`);
        const existing = existingFor(company);
        await db.$transaction(async tx => {
          const prospect = existing ?? await tx.prospect.create({ data: { companyName: company.name, dedupeKey: `live::${dedupeCompany(company.name, company.country)}`, country: company.country, vertical: company.vertical, website: company.website, employeeCountEstimate: company.employeeCountEstimate, runId: run.id, discoveryMode: 'live' } });
          const evidence = [];
          for (const item of items) {
            const previous = await tx.evidence.findFirst({ where: { entityType: 'PROSPECT', entityId: prospect.id, sourceUrl: item.sourceUrl, snippet: item.snippet } });
            evidence.push(previous ?? await tx.evidence.create({ data: { ...item, entityType: 'PROSPECT', entityId: prospect.id, provider: 'live' } }));
          }
          if (exec) {
            const previous = await tx.evidence.findFirst({ where: { entityType: 'PROSPECT', entityId: prospect.id, sourceUrl: exec.sourceUrl, title: 'Verified executive (Wikidata)' } });
            if (!previous) await tx.evidence.create({ data: { entityType: 'PROSPECT', entityId: prospect.id, sourceUrl: exec.sourceUrl, sourceName: 'Wikidata', sourceDate: new Date(), title: 'Verified executive (Wikidata)', snippet: `${exec.name} — ${exec.role} of ${company.name}, per a structured, sourced Wikidata claim. Person page: ${exec.personSourceUrl}`, confidence: 0.8, provider: 'live', isDemo: false } });
          }
          const { score, breakdown } = scoreLiveCompany(company, evidence.length, Boolean(exec));
          const useCase = USE_CASE_BY_VERTICAL[company.vertical];
          const why = [
            `${company.employeeCountEstimate} public directory headcount in ${company.country}.`,
            evidence.length ? `${evidence.length} real, live evidence item(s) found — see Evidence below.` : sourceErrors.length ? 'Live sources could not be reached this run (see run steps) — not yet checked, not a confirmed negative.' : 'No real live evidence found for this name (Wikipedia, Hacker News both checked, both empty).',
            exec ? `Verified contact: ${exec.name} (${exec.role}), currently-holding tenure confirmed via Wikidata.` : 'Current role not verified — Wikidata has no unambiguous current CEO/director claim for this company (either none exists, or multiple past holders with no clear current one). No outreach draft was created for this reason.',
          ];
          await tx.prospect.update({ where: { id: prospect.id }, data: { opportunityScore: score, scoreBreakdownJson: JSON.stringify(breakdown), useCase: useCase.useCase, useCaseRationale: useCase.rationale, status: existing?.status === 'NEW' ? 'SCORED' : existing?.status ?? 'SCORED', whyJson: JSON.stringify(why), runId: run.id } });
          await tx.scoreHistory.create({ data: { prospectId: prospect.id, score, breakdownJson: JSON.stringify(breakdown) } });

          // Reconcile against what's actually stored: a previous run's
          // verified contact can turn out to be wrong (e.g. Wikidata listing
          // a former CEO) once the tenure-aware lookup above is applied to a
          // company that already has a saved decision maker from before that
          // fix existed. Never leave a stale contact and its draft/approval
          // sitting there silently — correct it the same way a human review
          // would: retire the wrong contact and its pending approval, and
          // create the right one (or none, if no current holder is known).
          const staleDecisionMaker = await tx.decisionMaker.findFirst({ where: { prospectId: prospect.id, isReal: true } });
          if (staleDecisionMaker && staleDecisionMaker.name !== exec?.name) {
            const staleMessages = await tx.outreachMessage.findMany({ where: { decisionMakerId: staleDecisionMaker.id } });
            for (const m of staleMessages) {
              await tx.approvalItem.updateMany({ where: { entityId: m.id, status: 'PENDING' }, data: { status: 'SUPERSEDED', decidedAt: new Date() } });
            }
            const staleMessageIds = staleMessages.map(m => m.id);
            await tx.outreachMessage.deleteMany({ where: { id: { in: staleMessageIds } } });
            await tx.decisionMaker.delete({ where: { id: staleDecisionMaker.id } });
            await tx.auditLogEntry.create({ data: { actor: 'agent', action: 'contact_verification_corrected', entityType: 'DecisionMaker', entityId: staleDecisionMaker.id, detailJson: JSON.stringify({ runId: run.id, company: company.name, removedName: staleDecisionMaker.name, removedTitle: staleDecisionMaker.title, reason: 'Tenure-aware Wikidata re-check found this contact is no longer verified as currently holding the role.', replacedWith: exec?.name ?? null, supersededMessages: staleMessageIds.length }) } });
          }
          if (exec) {
            let decisionMaker = staleDecisionMaker?.name === exec.name ? staleDecisionMaker : await tx.decisionMaker.findFirst({ where: { prospectId: prospect.id, isReal: true, name: exec.name } });
            if (!decisionMaker) decisionMaker = await tx.decisionMaker.create({ data: { prospectId: prospect.id, name: exec.name, title: exec.role, confidence: 0.8, isReal: true, whyThisPerson: `Listed as ${exec.role} of ${company.name} on Wikidata — automatically verified via a structured, sourced claim (current tenure checked against start/end-date qualifiers), not manually double-checked by a human. Source: ${exec.personSourceUrl}` } });
            const hasDraft = await tx.outreachMessage.findFirst({ where: { prospectId: prospect.id, decisionMakerId: decisionMaker.id } });
            if (!hasDraft) {
              const firstName = exec.name.split(' ')[0];
              const wikiEvidence = evidence.find(e => e.sourceName === 'Wikipedia');
              // A dated source (e.g. a 2017 Hacker News post) is never used
              // to imply something is happening NOW — only cited as
              // background when it's actually recent (<2 years old).
              const TWO_YEARS_MS = 2 * 365 * 86400000;
              const otherEvidence = evidence.find(e => e !== wikiEvidence);
              const otherIsRecent = otherEvidence ? Date.now() - otherEvidence.sourceDate.getTime() < TWO_YEARS_MS : false;
              const evidenceLine = wikiEvidence
                ? `I came across ${company.name} — ${wikiEvidence.snippet.slice(0, 200).replace(/\s+\S*$/, '')}…`
                : otherEvidence
                  ? (otherIsRecent
                    ? `${company.name} came up in public discussion recently (${otherEvidence.sourceName}: "${otherEvidence.title}").`
                    : `For background, ${company.name} came up in a ${otherEvidence.sourceDate.getFullYear()} public discussion (${otherEvidence.sourceName}: "${otherEvidence.title}") — sharing as context, not a claim that anything is happening there right now.`)
                  : `I came across ${company.name} and wanted to reach out directly.`;
              const body = `Hi ${firstName},\n\n${evidenceLine} As ${exec.role.toLowerCase()} there, I'd guess ${useCase.useCase.toLowerCase()} is something your team thinks about.\n\nWe work with enterprise teams on AI-assisted ${useCase.useCase.toLowerCase()} — happy to share what we're seeing elsewhere and hear whether it's relevant at ${company.name} right now.\n\nOpen to a short call?\n\n— Wonderful`;
              const angle = `Ready to review — addressed to a real, Wikidata-verified contact (${exec.name}, ${exec.role}), grounded in ${evidence.length} real evidence item(s).`;
              const email = await tx.outreachMessage.create({ data: { prospectId: prospect.id, decisionMakerId: decisionMaker.id, channel: 'EMAIL', subject: `Wonderful × ${company.name}`, body, angle, status: 'AWAITING_APPROVAL' } });
              await tx.approvalItem.create({ data: { kind: 'OUTREACH_EMAIL', entityType: 'OutreachMessage', entityId: email.id, title: `Review draft for ${company.name} (real, verified contact)`, payloadJson: JSON.stringify(email) } });
              await tx.outreachMessage.create({ data: { prospectId: prospect.id, decisionMakerId: decisionMaker.id, channel: 'LINKEDIN', body, angle, status: 'DRAFT' } });
              actionsCreated += 2;
            }
          }
          await tx.auditLogEntry.create({ data: { actor: 'agent', action: existing ? 'prospect_rescored' : 'prospect_discovered', entityType: 'Prospect', entityId: prospect.id, detailJson: JSON.stringify({ runId: run.id, score, evidenceCount: evidence.length, verifiedExecutive: Boolean(exec), sourceErrors }) } });
        }, { timeout: 15000 });
        if (existing) refreshed++; else entitiesAccepted++;
      }
      const summary = `Live discovery: ${candidates.length} companies checked (${entitiesAccepted} new, ${refreshed} refreshed), ${sourcesChecked} real evidence items found, ${verifiedContacts} verified executive contact(s) found via Wikidata.${sourceErrorCount ? ` ${sourceErrorCount} company/companies had a live-source error this run.` : ''}`;
      const warnings = sourceErrorCount ? [`${sourceErrorCount} company/companies had a live-source fetch error this run (network/timeout) — their "no evidence found" is inconclusive, not a confirmed negative. See run steps for which.`] : [];
      await db.agentRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', endedAt: new Date(), durationMs: Date.now() - run.startedAt.getTime(), sourcesChecked, entitiesFound: candidates.length, entitiesAccepted, actionsCreated, summary, warningsJson: JSON.stringify(warnings), stepsJson: JSON.stringify(steps) } });
      return { runId: run.id, entitiesFound: candidates.length, entitiesAccepted, actionsCreated, refreshed, verifiedContacts };
    } catch (err) {
      await db.agentRun.update({ where: { id: run.id }, data: { status: 'FAILED', endedAt: new Date(), durationMs: Date.now() - run.startedAt.getTime(), errorMessage: err instanceof Error ? err.message : String(err), stepsJson: JSON.stringify(steps) } }); throw err;
    }
  });
}
