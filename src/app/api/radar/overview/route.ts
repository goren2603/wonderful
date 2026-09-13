import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companyName = searchParams.get("company") ?? "Wonderful";
  const lens = searchParams.get("lens"); // CANDIDATE | CUSTOMER | EXECUTIVE | INVESTOR

  const company = await db.company.findUnique({ where: { name: companyName } });
  if (!company) return NextResponse.json({ error: "company not found" }, { status: 404 });

  const [themes, alerts, mentions] = await Promise.all([
    db.theme.findMany({
      where: { companyId: company.id },
      include: { trend: { orderBy: { weekStart: "asc" } }, _count: { select: { mentions: true } } },
    }),
    db.alert.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } }),
    db.mention.findMany({
      where: { companyId: company.id, ...(lens ? { audienceLens: lens } : {}) },
      orderBy: { sourceDate: "desc" },
      take: 100,
    }),
  ]);

  const sentimentCounts = mentions.reduce(
    (acc, m) => {
      acc[m.sentiment] = (acc[m.sentiment] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({ company, themes, alerts, mentions, sentimentCounts });
}
