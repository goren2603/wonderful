import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const alert = await db.alert.findUnique({ where: { id: params.id }, include: { theme: true } });
  if (!alert) return NextResponse.json({ error: "not found" }, { status: 404 });

  const mentions = alert.themeId
    ? await db.mention.findMany({ where: { themeId: alert.themeId }, orderBy: { sourceDate: "asc" } })
    : [];
  const trend = alert.themeId
    ? await db.trendPoint.findMany({ where: { themeId: alert.themeId }, orderBy: { weekStart: "asc" } })
    : [];

  return NextResponse.json({ alert, mentions, trend });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const status = body.status as string | undefined;
  if (!status || !["OPEN", "ACKNOWLEDGED", "DISMISSED"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const alert = await db.alert.update({ where: { id: params.id }, data: { status } });
  await logAudit({ actor: "human", action: `alert_${status.toLowerCase()}`, entityType: "Alert", entityId: alert.id });
  return NextResponse.json({ ok: true, alert });
}
