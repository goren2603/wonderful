import { Cron } from "croner";
import { db } from "@/lib/db";
import { runTalentAnalysis } from "@/lib/agents/talentAgent";
import { runCompanyScoutScan } from "@/lib/agents/scoutAgent";
import { runRadarScan } from "@/lib/agents/radarAgent";
import { COUNTRIES, VERTICALS } from "@/lib/seedData/prospects";
import type { AgentKey } from "@/lib/types";

export const DEFAULT_JOBS: { agentKey: AgentKey; label: string; cronExpr: string }[] = [
  { agentKey: "COMPANY_SCOUT", label: "Daily market scan", cronExpr: "0 7 * * *" },
  { agentKey: "EXTERNAL_RADAR", label: "Signal monitoring", cronExpr: "0 */6 * * *" },
  { agentKey: "TALENT_INTELLIGENCE", label: "Weekly sourcing analysis", cronExpr: "0 6 * * 1" },
];

async function runAgent(agentKey: AgentKey) {
  if (agentKey === "TALENT_INTELLIGENCE") return runTalentAnalysis();
  if (agentKey === "COMPANY_SCOUT") return runCompanyScoutScan({ countries: COUNTRIES, verticals: VERTICALS, limit: 6 });
  if (agentKey === "EXTERNAL_RADAR") return runRadarScan("Wonderful");
}

let started = false;
const jobs: Cron[] = [];

/**
 * Starts the in-process scheduler. Works when the app runs as a persistent
 * Node process (local dev, Docker, Render/Fly/Railway). On a serverless
 * deploy (e.g. Vercel) the process doesn't stay alive between requests, so
 * use Vercel Cron hitting POST /api/agents/run instead — see README.
 */
export async function startScheduler() {
  if (started) return;
  started = true;

  const dbJobs = await db.scheduledJob.findMany();
  const byKey = new Map(dbJobs.map((j) => [j.agentKey, j]));

  for (const def of DEFAULT_JOBS) {
    const existing = byKey.get(def.agentKey);
    const cronExpr = existing?.cronExpr ?? def.cronExpr;
    const enabled = existing?.enabled ?? true;

    if (!existing) {
      await db.scheduledJob.create({
        data: { agentKey: def.agentKey, label: def.label, cronExpr, enabled },
      });
    }

    const job = new Cron(cronExpr, { paused: !enabled }, async () => {
      const current = await db.scheduledJob.findUnique({ where: { agentKey: def.agentKey } });
      if (!current?.enabled) return;
      try {
        const result = await runAgent(def.agentKey);
        await db.scheduledJob.update({
          where: { agentKey: def.agentKey },
          data: {
            lastRunAt: new Date(),
            lastStatus: "SUCCEEDED",
            lastResult: JSON.stringify(result ?? {}),
            nextRunAt: job.nextRun() ?? undefined,
          },
        });
      } catch (err) {
        await db.scheduledJob.update({
          where: { agentKey: def.agentKey },
          data: {
            lastRunAt: new Date(),
            lastStatus: "FAILED",
            lastResult: err instanceof Error ? err.message : String(err),
            nextRunAt: job.nextRun() ?? undefined,
          },
        });
      }
    });
    jobs.push(job);

    await db.scheduledJob.update({
      where: { agentKey: def.agentKey },
      data: { nextRunAt: job.nextRun() ?? undefined },
    });
  }
}

export async function triggerAgentRun(agentKey: AgentKey) {
  const result = await runAgent(agentKey);
  await db.scheduledJob.updateMany({
    where: { agentKey },
    data: { lastRunAt: new Date(), lastStatus: "SUCCEEDED", lastResult: JSON.stringify(result ?? {}) },
  });
  return result;
}
