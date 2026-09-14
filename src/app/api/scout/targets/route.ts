import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dedupeCompany } from "@/lib/scoutScoring";
import { fetchLiveEvidence, excludeSecurityIncidents, type EvidenceItem } from "@/lib/research";
import { USE_CASE_BY_VERTICAL, type Vertical } from "@/lib/seedData/prospects";

// Composes a draft that's actually ready to send when real evidence came
// back — grounded only in what was really fetched, never a fabricated pain
// point. Falls back to an honest placeholder when live sources found
// nothing, rather than inventing a reason.
function composeResearchNote(companyName: string, vertical: string, evidence: EvidenceItem[]): string {
  const useCase = USE_CASE_BY_VERTICAL[vertical as Vertical];
  const wiki = evidence.find((e) => e.sourceName === "Wikipedia");
  if (wiki) {
    const summary = wiki.snippet.length > 220 ? wiki.snippet.slice(0, 220).replace(/\s+\S*$/, "") + "…" : wiki.snippet;
    return `A bit about ${companyName}, from Wikipedia: "${summary}"${useCase ? ` Given that, I'd guess ${useCase.useCase.toLowerCase()} could be a live priority for your team — happy to be corrected.` : ""}`;
  }
  if (evidence.length > 0) {
    const item = evidence[0];
    const isRecent = Date.now() - item.sourceDate.getTime() < 2 * 365 * 86400000;
    const mention = isRecent
      ? `I saw ${companyName} come up in public discussion recently (${item.sourceName}: "${item.title}")`
      : `For background, ${companyName} came up in a ${item.sourceDate.getFullYear()} public discussion (${item.sourceName}: "${item.title}") — sharing as context, not a claim that anything is happening there right now`;
    return `${mention} — worth a quick look before you rely on it, but it's what surfaced.${useCase ? ` Separately, ${useCase.useCase.toLowerCase()} is often a live priority for companies your size — is that true at ${companyName}?` : ""}`;
  }
  return `[No public research was found automatically for ${companyName} — add a specific, real reason this matters before sending.]`;
}

// Manual intake for a REAL target: a real company and, optionally, a real
// named person you already know (your own contact, or one you've found).
// This does not invent research — nothing here is fabricated. It does fetch
// real, live evidence for the named company from two keyless public APIs
// (Wikipedia, Hacker News) and attaches whatever real, verifiable results
// come back (isDemo=false, each with its real source URL) — it can come back
// empty for a company with little public footprint, which is left as-is, not
// backfilled with anything synthetic. It creates a real prospect/decision-
// maker record and an outreach draft — personalized from the real evidence
// when any came back, an honest placeholder when it didn't — that stays
// approval-gated like every other draft; nothing is ever sent automatically.
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

  const dedupeKey = `manual::${dedupeCompany(companyName, country)}`;
  const liveEvidence = excludeSecurityIncidents(await fetchLiveEvidence(companyName)); // a sales lead's evidence panel shouldn't read as "we noticed you got hacked"
  try {
    const result = await db.$transaction(async (tx) => {
      const prospect = await tx.prospect.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          companyName,
          dedupeKey,
          country,
          vertical,
          status: "NEW",
          discoveryMode: "manual",
          whyJson: JSON.stringify([
            "Manually added as a real target — not from the demo discovery directory.",
            liveEvidence.length ? `${liveEvidence.length} real, live evidence item(s) fetched at intake (Wikipedia/Hacker News) — see Evidence below.` : "No live public evidence found for this name at intake (Wikipedia/Hacker News returned nothing).",
          ]),
        },
      });
      for (const item of liveEvidence) {
        const exists = await tx.evidence.findFirst({ where: { entityType: "PROSPECT", entityId: prospect.id, sourceUrl: item.sourceUrl, snippet: item.snippet } });
        if (!exists) await tx.evidence.create({ data: { ...item, entityType: "PROSPECT", entityId: prospect.id, provider: "live" } });
      }

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
        const researchNote = composeResearchNote(companyName, vertical, liveEvidence);
        const body = `Hi ${personName.split(" ")[0]},\n\nI'm reaching out from Wonderful — we help enterprise teams apply AI to customer service, support, and operational workflows.\n\n${researchNote}\n\nOpen to a short conversation?\n\n— Wonderful`;
        const ready = liveEvidence.length > 0;
        outreach = await tx.outreachMessage.create({
          data: {
            prospectId: prospect.id,
            decisionMakerId: decisionMaker.id,
            channel: linkedinUrl ? "LINKEDIN" : "EMAIL",
            subject: email ? `Wonderful × ${companyName}` : null,
            body,
            angle: ready ? `Ready to review and send — personalized using ${liveEvidence.length} real, live evidence item(s) fetched at intake.` : "Starter draft — no live evidence was found automatically; add a specific, real reason this matters before sending.",
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
