import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeTheme } from '@/lib/radarAnalysis';
import { AUDIENCE_LENSES } from '@/lib/types';
import { LEADERSHIP, LEADERSHIP_SOURCE, LEADERSHIP_VERIFIED_AT } from '@/lib/leadershipNews';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const query=new URL(req.url).searchParams;
  const lens=query.get('lens');
  if(lens&&!AUDIENCE_LENSES.includes(lens as typeof AUDIENCE_LENSES[number])) return NextResponse.json({error:'Invalid audience lens'},{status:400});
  const company=await db.company.findUnique({where:{name:query.get('company')??'Wonderful'}});
  if(!company) return NextResponse.json({error:'Company not found'},{status:404});
  const themesRaw=await db.theme.findMany({where:{companyId:company.id},include:{mentions:{where:lens?{audienceLens:lens}:undefined},alerts:{orderBy:{createdAt:'desc'}}}});
  const themes=themesRaw.filter(t=>t.mentions.length).map(t=>{const a=analyzeTheme(t.label,t.mentions);return {id:t.id,label:t.label,category:t.category,trend:a.trend,_count:{mentions:t.mentions.length},analysis:a,alert:t.alerts[0]};});
  const typeLabel=(type:string)=>type==='RISK'?'Risk':type==='OPPORTUNITY'?'Opportunity':'Signal';
  const alerts=themes.filter(t=>t.analysis.qualifies&&t.alert).map(t=>({...t.alert!,isDemo:t.analysis.recent.some(m=>m.isDemo),title:`${typeLabel(t.analysis.type)}: ${t.label}`,type:t.analysis.type,severity:t.analysis.severity,confidence:t.analysis.confidence,state:t.analysis.state,evidenceCount:t.analysis.evidenceCount,baseline:t.analysis.baseline,trend:t.analysis.trendText,aiExplanation:t.analysis.explanation,lastWeekCount:t.analysis.lastWeekCount,executiveCount:t.analysis.executiveCount}));
  const mentions=themesRaw.flatMap(t=>t.mentions).sort((a,b)=>b.sourceDate.getTime()-a.sourceDate.getTime());
  const sentimentCounts=mentions.reduce((acc,m)=>{acc[m.sentiment]=(acc[m.sentiment]??0)+1;return acc;},{} as Record<string,number>);
  const executiveMentionCount=mentions.filter(m=>m.audienceLens==='EXECUTIVE').length;
  const leadershipArticles = company.isDefault ? await db.evidence.findMany({ where: { entityType: 'LEADERSHIP', entityId: company.id, isDemo: false }, orderBy: { sourceDate: 'desc' }, take: 50 }) : [];
  const lastLeadershipScan = company.isDefault ? await db.auditLogEntry.findFirst({ where: { action: 'leadership_scan', entityId: company.id }, orderBy: { createdAt: 'desc' } }) : null;
  const leadership = company.isDefault ? { people: LEADERSHIP, sourceUrl: LEADERSHIP_SOURCE, verifiedAt: LEADERSHIP_VERIFIED_AT, articles: leadershipArticles.map(a => ({ ...a, ...JSON.parse(a.snippet) })), lastScan: lastLeadershipScan ? { at: lastLeadershipScan.createdAt, ...JSON.parse(lastLeadershipScan.detailJson) } : null } : null;
  return NextResponse.json({company,themes:themes.map(({analysis,alert,...t})=>t),alerts,mentions,sentimentCounts,executiveMentionCount,leadership});
}


