import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const prospect = await db.prospect.findUnique({
    where: { id: params.id },
    include: { decisionMakers: true, outreach: true, scoreHistory: { orderBy: { recordedAt: "asc" } } },
  });
  if (!prospect) return NextResponse.json({ error: "not found" }, { status: 404 });

  const evidence = await db.evidence.findMany({
    where: { entityType: "PROSPECT", entityId: prospect.id },
    orderBy: { fetchedAt: "desc" },
  });

  return NextResponse.json({ prospect, evidence });
}
