import { db } from '@/lib/db';
import { RADAR_THEMES } from '@/lib/seedData/radar';
import { withAgentLease } from '@/lib/agentRuntime';
import { classifyTheme, analyzeTheme } from '@/lib/radarAnalysis';
import type { AgentStep } from '@/lib/types';

export async function seedRadarData(companyName='Wonderful') {
  const company=await db.company.upsert({where:{name:companyName},update:{},create:{name:companyName,isDefault:companyName==='Wonderful'}});
  // Fixtures are only ingested by an explicit demo scenario/seed action; never invented by a monitoring pass.
  for(const t of RADAR_THEMES) for(const m of t.mentions) {
    const exists=await db.mention.findFirst({where:{companyId:company.id,text:m.text,sourceUrl:m.sourceUrl}});
    if(!exists) await db.mention.create({data:{companyId:company.id,text:m.text,sourceName:m.sourceName,sourceUrl:m.sourceUrl,sourceDate:new Date(Date.now()-m.weeksAgo*7*86400000),audienceLens:m.audienceLens,sentiment:m.sentiment,category:m.category,isDemo:true}});
  }
  return company.id;
}
export async function runRadarScan(companyName?:string) {
  return withAgentLease('EXTERNAL_RADAR',async()=>{
    const run=await db.agentRun.create({data:{agent:'EXTERNAL_RADAR',goal:`Recompute monitored signals for ${companyName??'all tracked companies'}`}});
    const steps:AgentStep[]=[];
    let sourcesChecked=0,actionsCreated=0,entitiesFound=0;
    try {
      const companies=await db.company.findMany({where:companyName?{name:companyName}:undefined});
      if(companyName&&!companies.length) throw new Error('Company not found');
      for(const company of companies) {
        const mentions=await db.mention.findMany({where:{companyId:company.id}});
        sourcesChecked+=mentions.length;
        const clusters=new Map<string,{category:string;ids:string[]}>();
        for(const m of mentions) {const c=classifyTheme(m.text,m.category);const group=clusters.get(c.label)??{category:c.category,ids:[]};group.ids.push(m.id);clusters.set(c.label,group);}
        steps.push({label:'Clustering',detail:`${company.name}: ${mentions.length} stored mentions classified into ${clusters.size} text-rule themes. No external pages fetched.`,at:new Date().toISOString()});
        await db.agentRun.update({where:{id:run.id},data:{stepsJson:JSON.stringify(steps)}});
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
          }
          // Preserve old themes/alerts for audit, but remove obsolete memberships. API hides empty clusters.
          await tx.auditLogEntry.create({data:{actor:'agent',action:'radar_scan',entityType:'Company',entityId:company.id,detailJson:JSON.stringify({runId:run.id,mentions:mentions.length,clusters:clusters.size})}});
        },{timeout:30000});
      }
      const summary=`Reanalyzed ${sourcesChecked} stored mentions across ${companies.length} companies; ${entitiesFound} new alerts, ${actionsCreated} qualifying alerts refreshed. 0 web pages fetched.`;
      await db.agentRun.update({where:{id:run.id},data:{status:'SUCCEEDED',endedAt:new Date(),durationMs:Date.now()-run.startedAt.getTime(),sourcesChecked,entitiesFound,entitiesAccepted:entitiesFound,actionsCreated,summary,warningsJson:JSON.stringify(['Live monitoring adapter not implemented. Demo scans only analyze stored evidence. Keyword clustering and source-count confidence are heuristics.']),stepsJson:JSON.stringify(steps)}});
      return {runId:run.id,entitiesFound,summary};
    } catch(err) {await db.agentRun.update({where:{id:run.id},data:{status:'FAILED',endedAt:new Date(),errorMessage:err instanceof Error?err.message:String(err),stepsJson:JSON.stringify(steps)}});throw err;}
  });
}
