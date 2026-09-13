import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AgentKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent") as AgentKey | null;
  const limit = Number(searchParams.get("limit") ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({error:"limit must be 1–100"},{status:400});

  const runs = await db.agentRun.findMany({
    where: agent ? { agent } : undefined,
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ runs });
}
