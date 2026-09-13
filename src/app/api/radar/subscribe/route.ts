import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Self-serve opt-in for real spike-alert emails — a human types their own
// address in and submits it. Nothing here is pre-populated with anyone's
// address on their behalf.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });

  const subscriber = await db.alertSubscriber.upsert({ where: { email }, update: {}, create: { email } });
  return NextResponse.json({ ok: true, subscriber });
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  await db.alertSubscriber.deleteMany({ where: { email } });
  return NextResponse.json({ ok: true });
}
