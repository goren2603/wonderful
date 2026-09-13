import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FEEDBACK_TARGETS, FEEDBACK_VOTES } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { targetType, targetId, vote, note } = body;
  if (!FEEDBACK_TARGETS.includes(targetType) || typeof targetId!=="string" || !targetId || !FEEDBACK_VOTES.includes(vote) || (note != null && (typeof note!=="string" || note.length>2000))) {
    return NextResponse.json({ error: "targetType, targetId, vote required" }, { status: 400 });
  }
  const exists=targetType==='PROSPECT'?await db.prospect.findUnique({where:{id:targetId}}):targetType==='ALERT'?await db.alert.findUnique({where:{id:targetId}}):await db.sourcingInsight.findUnique({where:{id:targetId}});
  if(!exists) return NextResponse.json({error:"Feedback target not found"},{status:404});
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
