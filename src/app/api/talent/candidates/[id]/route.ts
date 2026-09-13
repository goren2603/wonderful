import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const candidate = await db.candidate.findUnique({
    where: { id: params.id },
    include: { hire: true, performance: true, interviews: true, rankings: true },
  });
  if (!candidate) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ candidate });
}
