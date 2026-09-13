import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeTheme } from '@/lib/radarAnalysis';
import { logAudit } from '@/lib/audit';
export async function GET(req:Request,{params}:{params:{id:string}}) {
  const alert=await db.alert.findUnique({where:{id:params.id},include:{theme:true}});
  if(!alert) return NextResponse.json({error:'Alert not found'},{status:404});
  const lens=new URL(req.url).searchParams.get('lens');
  const all=alert.themeId?await db.mention.findMany({where:{themeId:alert.themeId,...(lens?{audienceLens:lens}:{})},orderBy:{sourceDate:'asc'}}):[];
  const analysis=analyzeTheme(alert.theme?.label??'',all);
  return NextResponse.json({alert:{...alert,evidenceCount:analysis.evidenceCount,baseline:analysis.baseline,trend:analysis.trendText,aiExplanation:analysis.explanation,recommendedAction:analysis.action,confidence:analysis.confidence,severity:analysis.severity,type:analysis.type,state:analysis.state},mentions:analysis.recent,trend:analysis.trend});
}
export async function PATCH(req:Request,{params}:{params:{id:string}}) {
  const body=await req.json().catch(()=>({}));
  if(!['OPEN','ACKNOWLEDGED','DISMISSED'].includes(body.status)) return NextResponse.json({error:'Invalid status'},{status:400});
  if(!await db.alert.findUnique({where:{id:params.id}})) return NextResponse.json({error:'Alert not found'},{status:404});
  const alert=await db.alert.update({where:{id:params.id},data:{status:body.status}});
  await logAudit({actor:'human',action:`alert_${body.status.toLowerCase()}`,entityType:'Alert',entityId:alert.id});
  return NextResponse.json({ok:true,alert});
}
