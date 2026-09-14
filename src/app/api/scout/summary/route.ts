import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelineStage, QUALIFIED_THRESHOLD } from "@/lib/scoutScoring";
import { PIPELINE_STAGES } from "@/lib/types";

export const dynamic = "force-dynamic";

// Real results only: everything here is scoped to discoveryMode "live"
// (found by the agent's own live discovery) or "manual" (a real target you
// added) — the sample-scenario accounts (discoveryMode "demo") never count
// toward these numbers, even if some were advanced through approve/send/
// reply for illustration. See /api/scout/scenario-summary for that view.
const REAL_MODES = ["live", "manual"];

export async function GET() {
  const latestRun = await db.agentRun.findFirst({ where: { agent: "COMPANY_SCOUT", status: "SUCCEEDED" }, orderBy: { startedAt: "desc" } });

  const [newQualifiedAccounts, decisionMakersIdentified, outreachSent, replies, meetingsBooked, allProspects] = await Promise.all([
    latestRun ? db.prospect.count({ where: { runId: latestRun.id, opportunityScore: { gte: QUALIFIED_THRESHOLD }, discoveryMode: { in: REAL_MODES } } }) : 0,
    latestRun ? db.decisionMaker.count({ where: { prospect: { runId: latestRun.id, discoveryMode: { in: REAL_MODES } }, isReal: true } }) : 0,
    db.outreachMessage.count({ where: { status: { in: ["SENT", "REPLIED", "FOLLOW_UP_DUE"] }, prospect: { discoveryMode: { in: REAL_MODES } } } }),
    db.prospect.count({ where: { status: { in: ["REPLIED", "MEETING_BOOKED"] }, discoveryMode: { in: REAL_MODES } } }),
    db.prospect.count({ where: { status: "MEETING_BOOKED", discoveryMode: { in: REAL_MODES } } }),
    db.prospect.findMany({ where: { discoveryMode: { in: REAL_MODES } }, select: { status: true, opportunityScore: true } }),
  ]);

  const pipelineCounts = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 0])) as Record<string, number>;
  for (const p of allProspects) pipelineCounts[pipelineStage(p)]++;

  const realOutreach = { prospect: { discoveryMode: { in: REAL_MODES } } };
  const [job, awaitingApproval, approved, followUpDue, reviewDraft] = await Promise.all([
    db.scheduledJob.findUnique({ where: { agentKey: 'COMPANY_SCOUT' }, select: { enabled: true, nextRunAt: true, lastStatus: true } }),
    db.outreachMessage.count({ where: { ...realOutreach, status: 'AWAITING_APPROVAL' } }),
    db.outreachMessage.count({ where: { ...realOutreach, status: 'APPROVED' } }),
    db.outreachMessage.count({ where: { ...realOutreach, status: 'FOLLOW_UP_DUE' } }),
    db.outreachMessage.findFirst({ where: { ...realOutreach, status: 'AWAITING_APPROVAL' }, select: { prospectId: true }, orderBy: { createdAt: 'asc' } }),
  ]);

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
    nextSteps: { job, awaitingApproval, approved, followUpDue, reviewProspectId: reviewDraft?.prospectId ?? null },
  });
}
