import { NextResponse } from "next/server";
import { seedRadarData, runRadarScan } from "@/lib/agents/radarAgent";
import { logAudit } from "@/lib/audit";
export async function POST(req:Request) {
  const body=await req.json().catch(()=>({}));
  if(typeof body.company!=="string"||!body.company.trim()||body.company.length>100) return NextResponse.json({error:"Company required"},{status:400});
  const id=await seedRadarData(body.company.trim());
  await logAudit({actor:"human",action:"demo_scenario_loaded",entityType:"Company",entityId:id});
  return NextResponse.json({ok:true,result:await runRadarScan(body.company.trim())});
}
