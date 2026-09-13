import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { OUTREACH_STATUSES } from '@/lib/types';

export async function PATCH(req:Request,{params}:{params:{id:string}}) {
  const body=await req.json().catch(()=>({}));
  if(!OUTREACH_STATUSES.includes(body.status)) return NextResponse.json({error:'Invalid status'},{status:400});
  try {
    const updated=await db.$transaction(async tx=>{
      const message=await tx.outreachMessage.findUnique({where:{id:params.id}});
      if(!message) throw new Error('Message not found');
      const transitions:Record<string,string[]>={DRAFT:['AWAITING_APPROVAL'],AWAITING_APPROVAL:[],APPROVED:['SENT'],SENT:['REPLIED','FOLLOW_UP_DUE'],FOLLOW_UP_DUE:['REPLIED'],REPLIED:[]};
      if(message.channel==='LINKEDIN') transitions.DRAFT=['SENT'];
      if(!transitions[message.status]?.includes(body.status)) throw new Error('Invalid transition. Approvals must use the approval workflow.');
      if(body.status==='SENT'&&body.manualConfirmed!==true) throw new Error('Confirm that you actually sent this message outside the app. No email delivery integration exists.');
      const extra:{replyNote?:string;nextAction?:string}={};
      if(typeof body.replyNote==='string'&&body.replyNote.length<=1000) extra.replyNote=body.replyNote;
      if(typeof body.nextAction==='string'&&body.nextAction.length<=300) extra.nextAction=body.nextAction;
      const updated=await tx.outreachMessage.update({where:{id:message.id},data:{status:body.status,...(body.status==='SENT'?{sentAt:new Date()}:{}),...extra}});
      if(body.status==='AWAITING_APPROVAL') await tx.approvalItem.create({data:{kind:'OUTREACH_EMAIL',entityType:'OutreachMessage',entityId:message.id,title:`Review draft: ${message.subject}`,payloadJson:JSON.stringify(message)}});
      if(body.status==='SENT') await tx.prospect.updateMany({where:{id:message.prospectId,status:{not:'REPLIED'}},data:{status:'CONTACTED'}});
      if(body.status==='REPLIED') await tx.prospect.update({where:{id:message.prospectId},data:{status:'REPLIED'}});
      await tx.auditLogEntry.create({data:{actor:'human',action:`outreach_${body.status.toLowerCase()}`,entityType:'OutreachMessage',entityId:message.id,detailJson:JSON.stringify({from:message.status,to:body.status,manualConfirmed:body.manualConfirmed===true,delivery:'external/manual'})}});
      return updated;
    });
    return NextResponse.json({ok:true,message:updated});
  } catch(err) {return NextResponse.json({error:err instanceof Error?err.message:'Update failed'},{status:409});}
}
