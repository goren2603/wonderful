import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET() {
  const latestRun=await db.agentRun.findFirst({where:{agent:'TALENT_INTELLIGENCE',status:'SUCCEEDED'},orderBy:{startedAt:'desc'}});
  const [candidateCount,hiredCount,withOutcomeCount,interviewCount,insights,weightProposals,evaluationRow,batchRanking]=await Promise.all([
    db.candidate.count({where:{isNewBatch:false}}),
    db.hireOutcome.count({where:{hired:true,candidate:{isNewBatch:false}}}),
    db.candidate.count({where:{isNewBatch:false,hire:{hired:true},performance:{retentionMonths:{not:null},managerRating:{not:null}}}}),
    db.candidate.count({where:{isNewBatch:false,interviews:{some:{}}}}),
    db.sourcingInsight.findMany({where:{runId:latestRun?.id??'none'}}),
    db.sourcingWeightProposal.findMany({orderBy:{generatedAt:'desc'},take:50}),
    db.sourcingModelEvaluation.findFirst({orderBy:{generatedAt:'desc'}}),
    // Rankings accumulate across runs (never deleted, so candidate detail
    // pages keep full history) — scope to the latest run's window here so
    // the summary table shows one row per candidate, not every past version.
    db.learnedRanking.findMany({where:{candidate:{isNewBatch:true},generatedAt:latestRun?{gte:latestRun.startedAt,lte:latestRun.endedAt??new Date()}:new Date(0)},orderBy:{newRank:'asc'},include:{candidate:true}}),
  ]);
  const evaluation=evaluationRow?{...evaluationRow,factorAudit:JSON.parse(evaluationRow.factorAuditJson)}:null;
  const batch=batchRanking.map(r=>({...r,delta:r.oldRank-r.newRank}));
  return NextResponse.json({candidateCount,hiredCount,withOutcomeCount,interviewCount,insights,weightProposals,latestRun,evaluation,batchRanking:batch});
}
