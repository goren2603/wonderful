import { db } from '@/lib/db';
import { RADAR_THEMES } from '@/lib/seedData/radar';
import { withAgentLease } from '@/lib/agentRuntime';
import { classifyTheme, analyzeTheme, weekStart } from '@/lib/radarAnalysis';
import { fetchLiveEvidenceDetailed } from '@/lib/research';
import { sendEmail } from '@/lib/email';
import type { AgentStep } from '@/lib/types';

const SPIKE_THRESHOLD = 5; // real negative mentions in the current calendar week that trigger a subscriber email

export async function seedRadarData(companyName='Wonderful') {
  const company=await db.company.upsert({where:{name:companyName},update:{},create:{name:companyName,isDefault:companyName==='Wonderful'}});
  // Fixtures are only ingested by an explicit demo scenario/seed action; never invented by a monitoring pass.
  for(const t of RADAR_THEMES) for(const m of t.mentions) {
    const exists=await db.mention.findFirst({where:{companyId:company.id,text:m.text,sourceUrl:m.sourceUrl}});
    if(!exists) await db.mention.create({data:{companyId:company.id,text:m.text,sourceName:m.sourceName,sourceUrl:m.sourceUrl,sourceDate:new Date(Date.now()-m.weeksAgo*7*86400000),audienceLens:m.audienceLens,sentiment:m.sentiment,category:m.category,isDemo:true}});
  }
  return company.id;
}

// Any company you add by name (via "Add any company" in Radar) gets real,
// live evidence for ITS OWN name — the same keyless Wikipedia + Hacker News
// lookup Growth Agent uses for a real target. This is what makes "add a
// competitor and compare it to Wonderful" real: the competitor's mentions
// are genuinely live.
//
// The default "Wonderful" company gets this too, searched as "wonderful.ai"
// rather than the bare word "wonderful" — a plain English word is too noisy
// for a keyword search (see fetchHackerNewsMentions' short-name guard in
// research.ts for the same reasoning applied to acronym-length names). Real
// results land alongside the seeded scenario mentions in the same company,
// each honestly flagged isDemo — expect this to surface little or nothing
// real for a small/newer company, which is itself an honest result, not a
// bug.
export const WONDERFUL_SEARCH_TERM = 'wonderful.ai';

async function ingestLiveCompanyMentions(companyId:string,searchTerm:string):Promise<{fetched:number;stored:number;sourceErrors:string[]}> {
  const {items,sourceErrors}=await fetchLiveEvidenceDetailed(searchTerm);
  let stored=0;
  for(const item of items) {
    const text=`Real, live public mention (${item.sourceName}): "${item.title}" — ${item.snippet.slice(0,300)}`;
    const exists=await db.mention.findFirst({where:{companyId,sourceUrl:item.sourceUrl,text}});
    // audienceLens is honestly a best-effort default here, not a verified
    // classification: we don't know who actually reads a given Wikipedia
    // summary or Hacker News post. General public company information is
    // closest to what an investor/market-watcher would track — it is NOT a
    // claim that any specific named executive said or saw this. Real named-
    // executive monitoring (a distinct, more valuable capability) would
    // require either the operator naming the people to track, or a separate
    // real search for "who leads this company."
    if(!exists) {await db.mention.create({data:{companyId,text,sourceName:item.sourceName,sourceUrl:item.sourceUrl,sourceDate:item.sourceDate,audienceLens:'INVESTOR',sentiment:'NEUTRAL',category:'Market signal',isDemo:item.isDemo}});stored++;}
  }
  return {fetched:items.length,stored,sourceErrors};
}

// Emails every self-serve subscriber once, the first time a theme's current
// calendar week crosses SPIKE_THRESHOLD real negative mentions — deduped by
// the AlertEmailNotification unique(themeId, weekStart), and only persisted
// as "handled" once an email actually went out, so a not-yet-configured
// sender or a temporary API error doesn't silently swallow the one chance to
// notify anyone.
async function maybeSendSpikeEmail(themeId:string,themeLabel:string,companyName:string,currentWeekMembers:{text:string;sourceUrl:string;sourceName:string;isDemo:boolean}[]) {
  const negative=currentWeekMembers.length;
  if(negative<SPIKE_THRESHOLD) return;
  const week=weekStart(new Date());
  const already=await db.alertEmailNotification.findUnique({where:{themeId_weekStart:{themeId,weekStart:week}}});
  if(already) return;
  const subscribers=await db.alertSubscriber.findMany();
  if(subscribers.length===0) return; // nothing persisted — retry on the next scan once someone subscribes
  const anyDemo=currentWeekMembers.some(m=>m.isDemo);
  const list=currentWeekMembers.slice(0,10).map(m=>`<li><a href="${m.sourceUrl}">${m.sourceName}</a>: ${m.text.replace(/</g,'&lt;')}</li>`).join('');
  const html=`<p><strong>${negative} negative mentions</strong> this week for "${themeLabel}" (${companyName}) — more than the ${SPIKE_THRESHOLD}-mention threshold.</p>${anyDemo?'<p><em>Note: this includes synthetic/demo scenario data, not exclusively real evidence — check the source column below.</em></p>':'<p>All real, live evidence — not synthetic.</p>'}<ul>${list}</ul><p style="color:#888;font-size:12px">You opted into these alerts at the Wonderful Intelligence demo. Open the Radar page and click Unsubscribe to stop.</p>`;
  const result=await sendEmail(subscribers.map(s=>s.email),`⚠ ${negative} negative mentions this week: ${themeLabel} (${companyName})`,html);
  if(result.sent) {
    await db.alertEmailNotification.create({data:{themeId,weekStart:week,recipientCount:subscribers.length,sent:true}});
    await db.auditLogEntry.create({data:{actor:'agent',action:'spike_email_sent',entityType:'Theme',entityId:themeId,detailJson:JSON.stringify({recipientCount:subscribers.length,negative,themeLabel,companyName})}});
  } else {
    await db.auditLogEntry.create({data:{actor:'agent',action:'spike_email_not_sent',entityType:'Theme',entityId:themeId,detailJson:JSON.stringify({reason:result.reason,recipientCount:subscribers.length,negative,themeLabel,companyName})}});
  }
}

export async function runRadarScan(companyName?:string) {
  return withAgentLease('EXTERNAL_RADAR',async()=>{
    const run=await db.agentRun.create({data:{agent:'EXTERNAL_RADAR',goal:`Recompute monitored signals for ${companyName??'all tracked companies'}`}});
    const steps:AgentStep[]=[];
    let sourcesChecked=0,actionsCreated=0,entitiesFound=0,liveFetched=0,liveStored=0,sourceErrorCount=0;
    try {
      const companies=await db.company.findMany({where:companyName?{name:companyName}:undefined});
      if(companyName&&!companies.length) throw new Error('Company not found');
      for(const company of companies) {
        // Every tracked company — including the default "Wonderful", searched
        // as its real domain — gets real live evidence for its own name.
        const searchTerm=company.isDefault?WONDERFUL_SEARCH_TERM:company.name;
        const liveIngest=await ingestLiveCompanyMentions(company.id,searchTerm);
        liveFetched+=liveIngest.fetched;liveStored+=liveIngest.stored;
        if(liveIngest.sourceErrors.length) {sourceErrorCount++;steps.push({label:'Source error',detail:`${company.name}: ${liveIngest.sourceErrors.join('; ')} — treat this run's "no new evidence" as inconclusive, not a confirmed negative.`,at:new Date().toISOString()});}
        else steps.push({label:'Fetching live source',detail:`Wikipedia + Hacker News for "${searchTerm}": ${liveIngest.fetched} real items fetched, ${liveIngest.stored} new mentions stored.`,at:new Date().toISOString()});
        await db.agentRun.update({where:{id:run.id},data:{stepsJson:JSON.stringify(steps)}});
        const mentions=await db.mention.findMany({where:{companyId:company.id}});
        sourcesChecked+=mentions.length;
        const clusters=new Map<string,{category:string;ids:string[]}>();
        for(const m of mentions) {const c=classifyTheme(m.text,m.category);const group=clusters.get(c.label)??{category:c.category,ids:[]};group.ids.push(m.id);clusters.set(c.label,group);}
        steps.push({label:'Clustering',detail:`${company.name}: ${mentions.length} stored mentions classified into ${clusters.size} text-rule themes.`,at:new Date().toISOString()});
        await db.agentRun.update({where:{id:run.id},data:{stepsJson:JSON.stringify(steps)}});
        const spikeCandidates:{themeId:string;label:string;members:{text:string;sourceUrl:string;sourceName:string;isDemo:boolean}[]}[]=[];
        await db.$transaction(async tx=>{
          for(const [label,cluster] of clusters) {
            const members=mentions.filter(m=>cluster.ids.includes(m.id));
            let theme=await tx.theme.findFirst({where:{companyId:company.id,label}});
            const dates=members.map(m=>m.sourceDate.getTime());
            const data={firstSeenAt:new Date(Math.min(...dates)),lastSeenAt:new Date(Math.max(...dates))};
            theme=theme?await tx.theme.update({where:{id:theme.id},data}):await tx.theme.create({data:{companyId:company.id,label,category:cluster.category,...data}});
            await tx.mention.updateMany({where:{id:{in:cluster.ids}},data:{themeId:theme.id}});
            const analysis=analyzeTheme(label,members);
            await tx.trendPoint.deleteMany({where:{themeId:theme.id}});
            for(const point of analysis.trend) await tx.trendPoint.create({data:{themeId:theme.id,...point}});
            const existing=await tx.alert.findFirst({where:{themeId:theme.id},orderBy:{createdAt:'desc'}});
            if(analysis.qualifies) {
              const typeLabel=analysis.type==='RISK'?'Risk':analysis.type==='OPPORTUNITY'?'Opportunity':'Signal';
              const alertData={title:`${typeLabel}: ${label}`,type:analysis.type,severity:analysis.severity,confidence:analysis.confidence,evidenceCount:analysis.evidenceCount,baseline:analysis.baseline,trend:analysis.trendText,state:analysis.state,aiExplanation:analysis.explanation,recommendedAction:analysis.action};
              const alert=existing?await tx.alert.update({where:{id:existing.id},data:alertData}):await tx.alert.create({data:{companyId:company.id,themeId:theme.id,...alertData}});
              // Current supporting evidence is refreshed; complete mention history remains in Mention.
              await tx.evidence.deleteMany({where:{entityType:'ALERT',entityId:alert.id}});
              for(const m of analysis.recent) await tx.evidence.create({data:{entityType:'ALERT',entityId:alert.id,sourceUrl:m.sourceUrl,sourceName:m.sourceName,sourceDate:m.sourceDate,title:label,snippet:m.text,confidence:m.isDemo?0:.5,isDemo:m.isDemo,provider:m.isDemo?'demo':'live'}});
              await tx.auditLogEntry.create({data:{actor:'agent',action:existing?'alert_recomputed':'alert_created',entityType:'Alert',entityId:alert.id,detailJson:JSON.stringify({runId:run.id,...alertData,mentionIds:analysis.recent.map(m=>m.id)})}});
              if(!existing) entitiesFound++;
              actionsCreated++;
            } else if(existing) {
              await tx.alert.update({where:{id:existing.id},data:{evidenceCount:analysis.evidenceCount,baseline:analysis.baseline,trend:analysis.trendText,state:'RESOLVED',aiExplanation:`Threshold no longer met. ${analysis.explanation}`}});
            }
            const week=weekStart(new Date());
            const currentWeekNegative=members.filter(m=>m.sentiment==='NEGATIVE'&&weekStart(m.sourceDate).getTime()===week.getTime());
            if(currentWeekNegative.length>=SPIKE_THRESHOLD) spikeCandidates.push({themeId:theme.id,label,members:currentWeekNegative});
          }
          // Preserve old themes/alerts for audit, but remove obsolete memberships. API hides empty clusters.
          await tx.auditLogEntry.create({data:{actor:'agent',action:'radar_scan',entityType:'Company',entityId:company.id,detailJson:JSON.stringify({runId:run.id,mentions:mentions.length,clusters:clusters.size})}});
        },{timeout:30000});
        for(const c of spikeCandidates) await maybeSendSpikeEmail(c.themeId,c.label,company.name,c.members);
      }
      const summary=`Reanalyzed ${sourcesChecked} stored mentions across ${companies.length} companies; ${entitiesFound} new alerts, ${actionsCreated} qualifying alerts refreshed. ${liveFetched} real live item(s) fetched this run.${sourceErrorCount?` ${sourceErrorCount} company/companies had a live-source error — see run steps.`:''}`;
      const warnings=[`Every tracked company — including "Wonderful" (searched as ${WONDERFUL_SEARCH_TERM}) — is checked against real, live, keyless public sources (Wikipedia, Hacker News search) every scan; "Wonderful" also keeps its original seeded scenario mentions alongside whatever real results come back, each individually flagged isDemo. A small/newer real company can honestly surface little or nothing live — that's a real result, not a bug. Keyword clustering and source-count confidence are heuristics either way.`];
      if(sourceErrorCount) warnings.push(`${sourceErrorCount} company/companies had a live-source fetch error this run (network/timeout) — their "no new evidence" is inconclusive, not a confirmed negative. See run steps for which.`);
      await db.agentRun.update({where:{id:run.id},data:{status:'SUCCEEDED',endedAt:new Date(),durationMs:Date.now()-run.startedAt.getTime(),sourcesChecked,entitiesFound,entitiesAccepted:entitiesFound,actionsCreated,summary,warningsJson:JSON.stringify(warnings),stepsJson:JSON.stringify(steps)}});
      return {runId:run.id,entitiesFound,summary};
    } catch(err) {await db.agentRun.update({where:{id:run.id},data:{status:'FAILED',endedAt:new Date(),errorMessage:err instanceof Error?err.message:String(err),stepsJson:JSON.stringify(steps)}});throw err;}
  });
}
