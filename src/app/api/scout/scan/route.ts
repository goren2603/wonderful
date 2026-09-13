import { NextResponse } from "next/server";
import { runCompanyScoutScan } from "@/lib/agents/scoutAgent";
import type { Country, Vertical } from "@/lib/seedData/prospects";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const countries = (body.countries ?? []) as Country[];
  const verticals = (body.verticals ?? []) as Vertical[];
  if (countries.length === 0 || verticals.length === 0) {
    return NextResponse.json({ error: "countries and verticals required" }, { status: 400 });
  }
  try {
    const result = await runCompanyScoutScan({ countries, verticals, limit: body.limit ?? 10 });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
