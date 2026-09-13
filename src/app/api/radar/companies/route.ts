import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await db.company.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return NextResponse.json({ error: "name must be 1–100 characters" }, { status: 400 });

  const existing = (await db.company.findMany()).find(c=>c.name.toLowerCase()===name.toLowerCase());
  if (existing) return NextResponse.json({ company: existing, alreadyExisted: true });

  const company = await db.company.create({ data: { name, isDefault: false } });
  return NextResponse.json({ company });
}
