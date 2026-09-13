import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const candidate = await db.candidate.findUnique({
    where: { id: params.id },
    include: { hire: true, performance: true, interviews: true, rankings: {orderBy:{generatedAt:"desc"}} },
  });
  if (!candidate) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ candidate });
}

export async function PATCH(req:Request,{params}:{params:{id:string}}) {
  const body=await req.json().catch(()=>({}));
  if(typeof body.retentionMonths!=="number"||!Number.isFinite(body.retentionMonths)||body.retentionMonths<0||body.retentionMonths>600||typeof body.managerRating!=="number"||!Number.isFinite(body.managerRating)||body.managerRating<1||body.managerRating>5) return NextResponse.json({error:"Retention must be 0–600 months; rating must be 1–5"},{status:400});
  const c=await db.candidate.findUnique({where:{id:params.id},include:{hire:true,performance:true}});
  if(!c) return NextResponse.json({error:"Candidate not found"},{status:404});
  if(!c.hire?.hired) return NextResponse.json({error:"Performance records require an existing hired outcome"},{status:409});
  await db.$transaction(async tx=>{
    const data={retentionMonths:body.retentionMonths,managerRating:body.managerRating,recordedAt:new Date()};
    await tx.performanceRecord.upsert({where:{candidateId:c.id},update:data,create:{candidateId:c.id,...data}});
    await tx.auditLogEntry.create({data:{actor:"human",action:"performance_updated",entityType:"Candidate",entityId:c.id,detailJson:JSON.stringify({before:c.performance,after:data})}});
  });
  return NextResponse.json({ok:true});
}
