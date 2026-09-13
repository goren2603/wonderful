import { db } from '@/lib/db';
import { getResearchProvider } from '@/lib/research';
import { withAgentLease, retry } from '@/lib/agentRuntime';
import { scoreCompany, dedupeCompany } from '@/lib/scoutScoring';
import { COUNTRIES, VERTICALS, USE_CASE_BY_VERTICAL, DECISION_MAKER_TITLES_BY_VERTICAL, type Country, type Vertical } from '@/lib/seedData/prospects';
import type { AgentStep } from '@/lib/types';
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
      const tracked=await db.prospect.findMany();
      // New companies first, then least recently researched. Repeated scans advance through the universe.
      const existingFor=(c:typeof universe[number])=>tracked.find(p=>dedupeCompany(p.companyName,p.country)===dedupeCompany(c.name,c.country));
      const candidates=universe.sort((a,b)=>(existingFor(a)?.lastUpdatedAt.getTime()??0)-(existingFor(b)?.lastUpdatedAt.getTime()??0)||a.name.localeCompare(b.name)).slice(0,params.limit??12);
      for(const company of candidates) {
        await step('Researching',`${company.name}: obtaining illustrative evidence from ${provider.name} provider; no web pages fetched in demo mode.`);
        const items=await retry(()=>provider.research(company));
        sourcesChecked+=items.length;
        const existing=existingFor(company);
        await db.$transaction(async tx=>{
          const prospect=existing??await tx.prospect.create({data:{companyName:company.name,dedupeKey:dedupeCompany(company.name,company.country),country:company.country,vertical:company.vertical,website:company.website,employeeCountEstimate:company.employeeCountEstimate,runId:run.id}});
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
