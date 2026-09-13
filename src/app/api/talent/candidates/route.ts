import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const geography = searchParams.get("geography");
  const hiredOnly = searchParams.get("hiredOnly") === "1";
  const sort = searchParams.get("sort") ?? "sourcingScore";
  const page = Number(searchParams.get("page") ?? 1);
  if(!Number.isInteger(page)||page<1||page>10000) return NextResponse.json({error:"Invalid page"},{status:400});
  const pageSize = 25;

  const includeBatch = searchParams.get("includeBatch") === "1";
  const where: Record<string, unknown> = includeBatch ? {} : { isNewBatch: false };
  if (domain) where.technicalDomain = domain;
  if (geography) where.geography = geography;
  if (hiredOnly) where.hire = { hired: true };

  const [total, candidates] = await Promise.all([
    db.candidate.count({ where }),
    db.candidate.findMany({
      where,
      include: { hire: true, performance: true, rankings: {orderBy:{generatedAt:"desc"},take:1} },
      orderBy: sort === "sourcingScore" ? { originalSourcingScore: "desc" } : { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ total, page, pageSize, candidates });
}
