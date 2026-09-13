import { NextResponse } from "next/server";
import { runRadarScan } from "@/lib/agents/radarAgent";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const companyName = (body.company as string | undefined) ?? "Wonderful";
  try {
    const result = await runRadarScan(companyName);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
