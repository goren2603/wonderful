import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGENT_KEYS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await db.scheduledJob.findMany();
  const jobsByKey = new Map(jobs.map((j) => [j.agentKey, j]));

  const results = await Promise.all(
    AGENT_KEYS.map(async (agent) => {
      const latestRun = await db.agentRun.findFirst({ where: { agent }, orderBy: { startedAt: "desc" } });
      const job = jobsByKey.get(agent);
      return { agent, job: job ?? null, latestRun };
    })
  );

  return NextResponse.json({ agents: results });
}
