import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { learnModel, scoreCandidate, REUSABLE_FACTORS } from '@/lib/talentModel';
export const dynamic='force-dynamic';
export async function GET() {
  const raw=await db.candidate.findMany({include:{hire:true,performance:true},orderBy:{id:'asc'}});
  const rows=raw.map(c=>({...c,hired:c.hire?.hired??false,retentionMonths:c.performance?.retentionMonths??null,managerRating:c.performance?.managerRating??null,highPerformer:c.performance?.highPerformer??null}));
  const model=learnModel(rows);
  const approved=await db.auditLogEntry.findFirst({where:{action:'active_model_approved'},orderBy:{createdAt:'desc'}});
  const active=approved?JSON.parse(approved.detailJson):null;
  const candidates=rows.map(c=>({id:c.id,name:c.name,originalSourcingScore:c.originalSourcingScore,hired:c.hired,isNewBatch:c.isNewBatch,values:Object.fromEntries(model.featureStats.map(s=>{const f=REUSABLE_FACTORS.find(rf=>rf.key===s.key)!;return [s.key,(f.extract(c)-s.mean)/s.std];})),activeScore:active?scoreCandidate(c,active.weights,active.featureStats):c.originalSourcingScore}));
  return NextResponse.json({factors:model.factors.filter(f=>f.key!=='originalSourcingScore'),featureStats:model.featureStats,candidates,eligible:model.eligible,activeModel:active?{...active,id:approved!.entityId,approvedAt:approved!.createdAt}:null});
}
