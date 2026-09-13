import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req:Request,{params}:{params:{id:string}}) {
  const body=await req.json().catch(()=>({}));
  if(!['APPROVED','REJECTED'].includes(body.decision)) return NextResponse.json({error:'Invalid decision'},{status:400});
  try {
    await db.$transaction(async tx=>{
      const item=await tx.approvalItem.findUnique({where:{id:params.id}});
      if(!item) throw new Error('Approval not found');
      if(item.status!=='PENDING') throw new Error('Approval already decided or superseded');
      const decision=body.decision as string;
      if(item.kind==='SOURCING_WEIGHT_CHANGE') {
        const proposal=await tx.sourcingWeightProposal.findUnique({where:{id:item.entityId}});
        const payload=JSON.parse(item.payloadJson);
        if(!proposal||proposal.status!=='PENDING') throw new Error('Stale proposal: rerun analysis');
        if(decision==='APPROVED'&&(!payload.weights||!payload.featureStats)) throw new Error('Legacy proposal has no applicable model. Rerun analysis.');
        await tx.sourcingWeightProposal.update({where:{id:item.entityId},data:{status:decision,decidedAt:new Date()}});
        if(decision==='APPROVED') await tx.auditLogEntry.create({data:{actor:'human',action:'active_model_approved',entityType:'SourcingModel',entityId:item.entityId,detailJson:item.payloadJson}});
      } else if(item.kind==='OUTREACH_EMAIL') {
        const message=await tx.outreachMessage.findUnique({where:{id:item.entityId}});
        if(!message||message.status!=='AWAITING_APPROVAL') throw new Error('Draft no longer awaits approval');
        await tx.outreachMessage.update({where:{id:item.entityId},data:{status:decision==='APPROVED'?'APPROVED':'DRAFT',approvedAt:decision==='APPROVED'?new Date():null}});
        if(decision==='APPROVED') await tx.prospect.updateMany({where:{id:message.prospectId,status:{in:['NEW','SCORED','RESEARCHED']}},data:{status:'OUTREACH_READY'}});
      } else throw new Error('Unsupported approval kind');
      await tx.approvalItem.update({where:{id:item.id},data:{status:decision,decidedAt:new Date()}});
      await tx.auditLogEntry.create({data:{actor:'human',action:`approval_${decision.toLowerCase()}`,entityType:item.kind,entityId:item.entityId,detailJson:JSON.stringify({approvalId:item.id})}});
    });
    return NextResponse.json({ok:true});
  } catch(err) {return NextResponse.json({error:err instanceof Error?err.message:'Approval failed'},{status:409});}
}
