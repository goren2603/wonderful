import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelineStage, QUALIFIED_THRESHOLD } from "@/lib/scoutScoring";
import { PIPELINE_STAGES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const latestRun = await db.agentRun.findFirst({ where: { agent: "COMPANY_SCOUT", status: "SUCCEEDED" }, orderBy: { startedAt: "desc" } });

  const [newQualifiedAccounts, decisionMakersIdentified, outreachSent, replies, meetingsBooked, allProspects] = await Promise.all([
    latestRun ? db.prospect.count({ where: { runId: latestRun.id, opportunityScore: { gte: QUALIFIED_THRESHOLD } } }) : 0,
    latestRun ? db.decisionMaker.count({ where: { prospect: { runId: latestRun.id } } }) : 0,
    db.outreachMessage.count({ where: { status: { in: ["SENT", "REPLIED", "FOLLOW_UP_DUE"] } } }),
    db.prospect.count({ where: { status: { in: ["REPLIED", "MEETING_BOOKED"] } } }),
    db.prospect.count({ where: { status: "MEETING_BOOKED" } }),
    db.prospect.findMany({ select: { status: true, opportunityScore: true } }),
  ]);

  const pipelineCounts = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0])) as Record<string, number>;
  for (const p of allProspects) pipelineCounts[pipelineStage(p)]++;

  return NextResponse.json({
    latestRun,
    stats: {
      companiesResearched: latestRun?.entitiesFound ?? 0,
      newQualifiedAccounts,
      decisionMakersIdentified,
      outreachSent,
      replies,
      meetingsBooked,
    },
    pipelineCounts,
  });
}
