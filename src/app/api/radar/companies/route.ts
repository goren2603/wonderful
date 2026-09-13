import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runRadarScan } from "@/lib/agents/radarAgent";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await db.company.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return NextResponse.json({ error: "name must be 1–100 characters" }, { status: 400 });

  const existing = (await db.company.findMany()).find(c=>c.name.toLowerCase()===name.toLowerCase());
  if (existing) return NextResponse.json({ company: existing, alreadyExisted: true });

  const company = await db.company.create({ data: { name, isDefault: false } });
  // Fetch real live evidence for this exact name right away, so the operator
  // sees genuine data on first load instead of an empty "load sample
  // scenario" prompt — this is what makes typing a competitor's name in and
  // immediately comparing it to Wonderful actually work.
  try {
    await runRadarScan(name);
  } catch {
    // Real live sources can legitimately return nothing for an obscure name;
    // the company still exists and can be scanned again from the UI.
  }
  return NextResponse.json({ company });
}
