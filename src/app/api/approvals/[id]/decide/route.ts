import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const decision = body.decision as "APPROVED" | "REJECTED" | undefined;
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  }

  const item = await db.approvalItem.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.approvalItem.update({ where: { id: item.id }, data: { status: decision, decidedAt: new Date() } });

  if (item.kind === "SOURCING_WEIGHT_CHANGE") {
    await db.sourcingWeightProposal.update({ where: { id: item.entityId }, data: { status: decision, decidedAt: new Date() } });
  } else if (item.kind === "OUTREACH_EMAIL") {
    await db.outreachMessage.update({
      where: { id: item.entityId },
      data: { status: decision === "APPROVED" ? "APPROVED" : "DRAFT", approvedAt: decision === "APPROVED" ? new Date() : null },
    });
  }

  await logAudit({
    actor: "human",
    action: `approval_${decision.toLowerCase()}`,
    entityType: item.kind,
    entityId: item.entityId,
    detail: { approvalItemId: item.id, title: item.title },
  });

  return NextResponse.json({ ok: true });
}
