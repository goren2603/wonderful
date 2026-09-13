import { db } from '@/lib/db';
import { RADAR_THEMES } from '@/lib/seedData/radar';
import { withAgentLease } from '@/lib/agentRuntime';
import { classifyTheme, analyzeTheme, weekStart } from '@/lib/radarAnalysis';
import { fetchLiveEvidence } from '@/lib/research';
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

// The one real, live-data company: unlike "Wonderful" (a fictional employer
// brand with no real public footprint), this tracks genuine, current public
// discussion of AI agents — the category Wonderful's own products sit in —
// fetched from a real, keyless public API (Hacker News' Algolia search).
// Every mention here is a real dated post with a real source URL; nothing is
// invented. It does not claim to be "about Wonderful" — the mention text says
// exactly what it is: real public industry discussion of the category.
export const LIVE_MARKET_COMPANY_NAME = 'AI Agent Market (real, live)';

async function ensureLiveMarketCompany() {
  return db.company.upsert({where:{name:LIVE_MARKET_COMPANY_NAME},update:{},create:{name:LIVE_MARKET_COMPANY_NAME,isDefault:false}});
}

async function ingestLiveMarketMentions(companyId:string):Promise<{fetched:number;stored:number}> {
  const sinceUnix=Math.floor((Date.now()-21*86400000)/1000);
  const url=`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent('AI agent')}&tags=story&numericFilters=created_at_i%3E${sinceUnix}&hitsPerPage=25`;
  let hits:unknown[]=[];
  try {
    const res=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'wonderful-intelligence-demo/1.0 (radar prototype)'}});
    if(res.ok) {const data=await res.json().catch(()=>null); hits=Array.isArray(data?.hits)?data.hits:[];}
  } catch { /* live source unreachable this run; scan proceeds on whatever is already stored */ }
  let stored=0;
  for(const raw of hits) {
    const hit=raw as {title?:string;url?:string;created_at?:string;objectID?:string;points?:number;num_comments?:number};
    if(!hit.title||!hit.created_at||!hit.objectID) continue;
    const discussionUrl=`https://news.ycombinator.com/item?id=${hit.objectID}`;
    const sourceUrl=hit.url||discussionUrl;
    const text=`Real, live Hacker News industry discussion and category interest: "${hit.title}" (${hit.points??0} points, ${hit.num_comments??0} comments, ${discussionUrl}).`;
    const exists=await db.mention.findFirst({where:{companyId,sourceUrl,text}});
    if(!exists) {await db.mention.create({data:{companyId,text,sourceName:'Hacker News',sourceUrl,sourceDate:new Date(hit.created_at),audienceLens:'EXECUTIVE',sentiment:'NEUTRAL',category:'Market signal',isDemo:false}});stored++;}
  }
  return {fetched:hits.length,stored};
}
// Any OTHER company you add by name (via "Add any company" in Radar) gets
// real, live evidence for ITS OWN name — the same keyless Wikipedia +
// Hacker News lookup Growth Agent uses for a real target — not the fixed
// "AI agent" market query above. This is what makes "add a competitor and
// compare it to Wonderful" real: the competitor's mentions are genuinely
// live; only the default "Wonderful" company stays on seeded scenario data
// (see AppNotice / researchStatus for why — no real public footprint to
// search for a placeholder name).
async function ingestLiveCompanyMentions(companyId:string,companyName:string):Promise<{fetched:number;stored:number}> {
  const items=await fetchLiveEvidence(companyName);
  let stored=0;
  for(const item of items) {
    const text=`Real, live public mention (${item.sourceName}): "${item.title}" — ${item.snippet.slice(0,300)}`;
    const exists=await db.mention.findFirst({where:{companyId,sourceUrl:item.sourceUrl,text}});
    if(!exists) {await db.mention.create({data:{companyId,text,sourceName:item.sourceName,sourceUrl:item.sourceUrl,sourceDate:item.sourceDate,audienceLens:'EXECUTIVE',sentiment:'NEUTRAL',category:'Market signal',isDemo:item.isDemo}});stored++;}
  }
  return {fetched:items.length,stored};
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
    let sourcesChecked=0,actionsCreated=0,entitiesFound=0,liveFetched=0,liveStored=0;
    try {
      if(!companyName) await ensureLiveMarketCompany(); // included in every scheduled "scan all" pass
      const companies=await db.company.findMany({where:companyName?{name:companyName}:undefined});
      if(companyName&&!companies.length) throw new Error('Company not found');
      for(const company of companies) {
        let liveIngest:{fetched:number;stored:number}|null=null;
        if(company.name===LIVE_MARKET_COMPANY_NAME) {
          liveIngest=await ingestLiveMarketMentions(company.id);
          liveFetched+=liveIngest.fetched;liveStored+=liveIngest.stored;
          steps.push({label:'Fetching live source',detail:`Hacker News (Algolia search API, last 21 days, query "AI agent"): ${liveIngest.fetched} posts fetched, ${liveIngest.stored} new mentions stored.`,at:new Date().toISOString()});
          await db.agentRun.update({where:{id:run.id},data:{stepsJson:JSON.stringify(steps)}});
        } else if(!company.isDefault) {
          // Any company added via "Add any company" that isn't the seeded
          // default ("Wonderful") gets real live evidence for its own name —
          // this is what makes a competitor comparison real.
          liveIngest=await ingestLiveCompanyMentions(company.id,company.name);
          liveFetched+=liveIngest.fetched;liveStored+=liveIngest.stored;
          steps.push({label:'Fetching live source',detail:`Wikipedia + Hacker News for "${company.name}": ${liveIngest.fetched} real items fetched, ${liveIngest.stored} new mentions stored.`,at:new Date().toISOString()});
          await db.agentRun.update({where:{id:run.id},data:{stepsJson:JSON.stringify(steps)}});
        }
        const mentions=await db.mention.findMany({where:{companyId:company.id}});
        sourcesChecked+=mentions.length;
        const clusters=new Map<string,{category:string;ids:string[]}>();
        for(const m of mentions) {const c=classifyTheme(m.text,m.category);const group=clusters.get(c.label)??{category:c.category,ids:[]};group.ids.push(m.id);clusters.set(c.label,group);}
        steps.push({label:'Clustering',detail:`${company.name}: ${mentions.length} stored mentions classified into ${clusters.size} text-rule themes.${liveIngest?' Includes live evidence fetched this run.':' No external pages fetched.'}`,at:new Date().toISOString()});
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
      const summary=`Reanalyzed ${sourcesChecked} stored mentions across ${companies.length} companies; ${entitiesFound} new alerts, ${actionsCreated} qualifying alerts refreshed.${liveFetched>0?` Live source this run: ${liveFetched} Hacker News posts fetched, ${liveStored} new.`:' 0 web pages fetched this run.'}`;
      const warnings=[`Only the default "Wonderful" company stays on seeded/scenario mentions (no real public footprint to search for a placeholder name). Every other tracked company — "${LIVE_MARKET_COMPANY_NAME}" and anything added via "Add any company" — is backed by real, live, keyless public sources (Wikipedia, Hacker News search). Keyword clustering and source-count confidence are heuristics either way.`];
      await db.agentRun.update({where:{id:run.id},data:{status:'SUCCEEDED',endedAt:new Date(),durationMs:Date.now()-run.startedAt.getTime(),sourcesChecked,entitiesFound,entitiesAccepted:entitiesFound,actionsCreated,summary,warningsJson:JSON.stringify(warnings),stepsJson:JSON.stringify(steps)}});
      return {runId:run.id,entitiesFound,summary};
    } catch(err) {await db.agentRun.update({where:{id:run.id},data:{status:'FAILED',endedAt:new Date(),errorMessage:err instanceof Error?err.message:String(err),stepsJson:JSON.stringify(steps)}});throw err;}
  });
}
