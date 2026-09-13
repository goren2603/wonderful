import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const run = await db.agentRun.findUnique({ where: { id: params.id } });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  const audit = await db.auditLogEntry.findMany({where:{OR:[{entityId:run.id},{detailJson:{contains:run.id}}]},orderBy:{createdAt:"asc"}});
  return NextResponse.json({ run, audit });
}
