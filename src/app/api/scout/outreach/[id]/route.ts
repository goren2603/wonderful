import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { OUTREACH_STATUSES, type OutreachStatus } from "@/lib/types";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const status = body.status as OutreachStatus | undefined;
  if (!status || !OUTREACH_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${OUTREACH_STATUSES.join(", ")}` }, { status: 400 });
  }

  const message = await db.outreachMessage.findUnique({ where: { id: params.id } });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Email sending stays approval-gated by default: block a jump straight to
  // SENT unless the message was already approved.
  if (status === "SENT" && message.channel === "EMAIL" && message.status !== "APPROVED") {
    return NextResponse.json({ error: "Email must be APPROVED before it can be marked sent" }, { status: 400 });
  }

  const data: Record<string, unknown> = { status };
  if (status === "APPROVED") data.approvedAt = new Date();
  if (status === "SENT") data.sentAt = new Date();

  const updated = await db.outreachMessage.update({ where: { id: params.id }, data });

  if (status === "AWAITING_APPROVAL") {
    await db.approvalItem.create({
      data: {
        kind: "OUTREACH_EMAIL",
        entityType: "OutreachMessage",
        entityId: message.id,
        title: `Send outreach — ${message.subject ?? message.channel}`,
        payloadJson: JSON.stringify(message),
        status: "PENDING",
      },
    });
  }

  await logAudit({
    actor: "human",
    action: `outreach_status_${status.toLowerCase()}`,
    entityType: "OutreachMessage",
    entityId: message.id,
    detail: { from: message.status, to: status, channel: message.channel },
  });

  return NextResponse.json({ ok: true, message: updated });
}
