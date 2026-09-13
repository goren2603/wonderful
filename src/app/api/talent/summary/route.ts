import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [candidateCount, hiredCount, insights, weightProposals, latestRun, rankings] = await Promise.all([
    db.candidate.count(),
    db.hireOutcome.count({ where: { hired: true } }),
    db.sourcingInsight.findMany({ orderBy: { generatedAt: "desc" } }),
    db.sourcingWeightProposal.findMany({ orderBy: { generatedAt: "desc" } }),
    db.agentRun.findFirst({ where: { agent: "TALENT_INTELLIGENCE" }, orderBy: { startedAt: "desc" } }),
    db.learnedRanking.findMany({ include: { candidate: true } }),
  ]);

  const movers = [...rankings]
    .map((r) => ({ ...r, delta: r.oldRank - r.newRank }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8);

  const withOutcomeCount = await db.performanceRecord.count();

  return NextResponse.json({
    candidateCount,
    hiredCount,
    withOutcomeCount,
    insights,
    weightProposals,
    latestRun,
    movers,
  });
}
