import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dedupeCompany } from "@/lib/scoutScoring";

// Manual intake for a REAL target: a real company and, optionally, a real
// named person you already know (your own contact, or one you've found).
// This does not invent research — no evidence is attached automatically. It
// creates a real prospect/decision-maker record and a starter outreach
// draft you (or a connected research pass) can refine before anything is
// ever sent, which stays approval-gated like every other draft.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const companyName = (body.companyName as string | undefined)?.trim();
  const country = (body.country as string | undefined)?.trim();
  const vertical = (body.vertical as string | undefined)?.trim();
  const personName = (body.personName as string | undefined)?.trim();
  const personTitle = (body.personTitle as string | undefined)?.trim();
  const linkedinUrl = (body.linkedinUrl as string | undefined)?.trim() || null;
  const email = (body.email as string | undefined)?.trim() || null;

  if (!companyName || companyName.length > 200) return NextResponse.json({ error: "companyName is required (max 200 chars)" }, { status: 400 });
  if (!country || country.length > 100) return NextResponse.json({ error: "country is required" }, { status: 400 });
  if (!vertical || vertical.length > 100) return NextResponse.json({ error: "vertical is required" }, { status: 400 });
  if (linkedinUrl && !/^https:\/\/(www\.)?linkedin\.com\//.test(linkedinUrl)) return NextResponse.json({ error: "linkedinUrl must be a linkedin.com URL" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "email is not valid" }, { status: 400 });

  const dedupeKey = dedupeCompany(companyName, country);
  try {
    const result = await db.$transaction(async (tx) => {
      const prospect = await tx.prospect.upsert({
        where: { dedupeKey },
        update: {},
        create: { companyName, dedupeKey, country, vertical, status: "NEW", whyJson: JSON.stringify(["Manually added as a real target — not from the demo discovery directory."]) },
      });

      let decisionMaker = null;
      let outreach = null;
      if (personName) {
        decisionMaker = await tx.decisionMaker.create({
          data: {
            prospectId: prospect.id,
            name: personName,
            title: personTitle || "Unspecified",
            linkedinUrl,
            email,
            confidence: 1,
            isReal: true,
            whyThisPerson: "Manually identified as a real target by the workspace operator.",
          },
        });
        const body = `Hi ${personName.split(" ")[0]},\n\nI'm reaching out from Wonderful — we help enterprise teams apply AI to customer service, support, and operational workflows.\n\n[Add a specific, researched reason this matters to ${companyName} here before sending.]\n\nOpen to a short conversation?\n\n{{sender_name}}`;
        outreach = await tx.outreachMessage.create({
          data: {
            prospectId: prospect.id,
            decisionMakerId: decisionMaker.id,
            channel: linkedinUrl ? "LINKEDIN" : "EMAIL",
            subject: email ? `Wonderful × ${companyName}` : null,
            body,
            angle: "Starter draft — needs real research on this company/person before it's ready to send.",
            status: "DRAFT",
          },
        });
      }

      await tx.auditLogEntry.create({ data: { actor: "human", action: "real_target_added", entityType: "Prospect", entityId: prospect.id, detailJson: JSON.stringify({ companyName, country, personName: personName || null }) } });
      return { prospect, decisionMaker, outreach };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add real target" }, { status: 500 });
  }
}
