import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await db.company.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const existing = await db.company.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ company: existing, alreadyExisted: true });

  const company = await db.company.create({ data: { name, isDefault: false } });
  return NextResponse.json({ company });
}
