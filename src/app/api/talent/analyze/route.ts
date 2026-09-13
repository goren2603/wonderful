import { NextResponse } from "next/server";
import { runTalentAnalysis } from "@/lib/agents/talentAgent";

export async function POST() {
  try {
    const result = await runTalentAnalysis();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
