import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Only the one manual, human-observed transition: a reply turned into a
// booked meeting. Everything else in the pipeline is agent-derived.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  if (body.status !== "MEETING_BOOKED") return NextResponse.json({ error: "Only MEETING_BOOKED is settable here" }, { status: 400 });
  try {
    const prospect = await db.$transaction(async (tx) => {
      const current = await tx.prospect.findUnique({ where: { id: params.id } });
      if (!current) throw new Error("Prospect not found");
      if (current.status !== "REPLIED") throw new Error("A meeting can only be booked after a reply is recorded");
      const updated = await tx.prospect.update({ where: { id: params.id }, data: { status: "MEETING_BOOKED" } });
      await tx.auditLogEntry.create({ data: { actor: "human", action: "meeting_booked", entityType: "Prospect", entityId: params.id, detailJson: "{}" } });
      return updated;
    });
    return NextResponse.json({ ok: true, prospect });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 409 });
  }
}

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
