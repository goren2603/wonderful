import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeTheme } from '@/lib/radarAnalysis';
import { AUDIENCE_LENSES } from '@/lib/types';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const query=new URL(req.url).searchParams;
  const lens=query.get('lens');
  if(lens&&!AUDIENCE_LENSES.includes(lens as typeof AUDIENCE_LENSES[number])) return NextResponse.json({error:'Invalid audience lens'},{status:400});
  const company=await db.company.findUnique({where:{name:query.get('company')??'Wonderful'}});
  if(!company) return NextResponse.json({error:'Company not found'},{status:404});
  const themesRaw=await db.theme.findMany({where:{companyId:company.id},include:{mentions:{where:lens?{audienceLens:lens}:undefined},alerts:{orderBy:{createdAt:'desc'}}}});
  const themes=themesRaw.filter(t=>t.mentions.length).map(t=>{const a=analyzeTheme(t.label,t.mentions);return {id:t.id,label:t.label,category:t.category,trend:a.trend,_count:{mentions:t.mentions.length},analysis:a,alert:t.alerts[0]};});
  const alerts=themes.filter(t=>t.analysis.qualifies&&t.alert).map(t=>({...t.alert!,title:`${t.analysis.type==='RISK'?'Risk':'Opportunity'}: ${t.label}`,type:t.analysis.type,severity:t.analysis.severity,confidence:t.analysis.confidence,evidenceCount:t.analysis.evidenceCount,baseline:t.analysis.baseline,trend:t.analysis.trendText,aiExplanation:t.analysis.explanation}));
  const mentions=themesRaw.flatMap(t=>t.mentions).sort((a,b)=>b.sourceDate.getTime()-a.sourceDate.getTime());
  const sentimentCounts=mentions.reduce((acc,m)=>{acc[m.sentiment]=(acc[m.sentiment]??0)+1;return acc;},{} as Record<string,number>);
  return NextResponse.json({company,themes:themes.map(({analysis,alert,...t})=>t),alerts,mentions,sentimentCounts});
}
