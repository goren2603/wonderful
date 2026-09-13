import { NextResponse } from "next/server";
import { triggerAgentRun } from "@/lib/scheduler";
import { COUNTRIES, VERTICALS } from "@/lib/seedData/prospects";
import type { AgentKey } from "@/lib/types";
import { AGENT_KEYS } from "@/lib/types";
import { runCompanyScoutScan } from "@/lib/agents/scoutAgent";

// Vercel Cron (or any external scheduler) hits this with GET and, when
// CRON_SECRET is set, an `Authorization: Bearer <CRON_SECRET>` header —
// see vercel.json and the README's serverless deployment notes.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentKey = searchParams.get("agentKey") as AgentKey | null;
  if (!agentKey || !AGENT_KEYS.includes(agentKey)) return NextResponse.json({ error: "valid agentKey required" }, { status: 400 });
  if (!process.env.CRON_SECRET) return NextResponse.json({error:"External cron is disabled until CRON_SECRET is configured"},{status:503});

  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await triggerAgentRun(agentKey);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const agentKey = body.agentKey as AgentKey | undefined;
  if (!agentKey || !AGENT_KEYS.includes(agentKey)) return NextResponse.json({ error: "valid agentKey required" }, { status: 400 });

  try {
    if (agentKey === "COMPANY_SCOUT" && (body.countries || body.verticals)) {
      const result = await runCompanyScoutScan({
        countries: body.countries?.length ? body.countries : COUNTRIES,
        verticals: body.verticals?.length ? body.verticals : VERTICALS,
        limit: body.limit ?? 8,
      });
      return NextResponse.json({ ok: true, result });
    }
    const result = await triggerAgentRun(agentKey);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
