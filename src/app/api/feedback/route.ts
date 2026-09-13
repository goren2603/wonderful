import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { targetType, targetId, vote, note } = body;
  if (!targetType || !targetId || !vote) {
    return NextResponse.json({ error: "targetType, targetId, vote required" }, { status: 400 });
  }
  const feedback = await db.feedback.create({ data: { targetType, targetId, vote, note: note ?? null } });
  return NextResponse.json({ ok: true, feedback });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("targetId");
  const items = await db.feedback.findMany({
    where: targetId ? { targetId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ items });
}
