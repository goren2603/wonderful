import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  const vertical = searchParams.get("vertical");
  const status = searchParams.get("status");
  const includeDemo = searchParams.get("includeDemo") === "1";

  const where: Record<string, unknown> = { discoveryMode: includeDemo ? undefined : { in: ["live", "manual"] } };
  if (country) where.country = country;
  if (vertical) where.vertical = vertical;
  if (status) where.status = status;

  const prospects = await db.prospect.findMany({
    where,
    orderBy: { opportunityScore: "desc" },
    include: { decisionMakers: true, outreach: true },
  });

  return NextResponse.json({ prospects });
}
