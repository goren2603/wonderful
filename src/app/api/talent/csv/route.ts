import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

function toBool(v: string): boolean {
  return ["true", "1", "yes", "y"].includes(v.trim().toLowerCase());
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Upload a CSV file under field name 'file'" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows found in CSV" }, { status: 400 });
  }

  let created = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    try {
      if (!row.name || !row.originalSourcingScore) {
        errors.push(`Row ${i + 2}: missing required field (name, originalSourcingScore)`);
        continue;
      }
      const candidate = await db.candidate.create({
        data: {
          name: row.name,
          currentTitle: row.currentTitle || "Unknown",
          yearsExperience: Number(row.yearsExperience) || 0,
          education: row.education || "Unknown",
          previousCompaniesJson: JSON.stringify(
            (row.previousCompanies || "").split(";").map((s) => s.trim()).filter(Boolean)
          ),
          startupExperience: toBool(row.startupExperience || "false"),
          technicalDomain: row.technicalDomain || "Full-stack",
          geography: row.geography || "Unknown",
          originalSourcingScore: Number(row.originalSourcingScore),
        },
      });

      if (row.interviewOutcome) {
        await db.interviewOutcome.create({
          data: {
            candidateId: candidate.id,
            stage: "Imported",
            outcome: row.interviewOutcome.toUpperCase(),
            interviewedAt: new Date(),
          },
        });
      }

      if (row.hired) {
        await db.hireOutcome.create({
          data: { candidateId: candidate.id, hired: toBool(row.hired) },
        });
      }

      if (row.retentionMonths || row.managerRating) {
        await db.performanceRecord.create({
          data: {
            candidateId: candidate.id,
            retentionMonths: row.retentionMonths ? Number(row.retentionMonths) : null,
            managerRating: row.managerRating ? Number(row.managerRating) : null,
            promotionVelocityMonths: row.promotionVelocityMonths ? Number(row.promotionVelocityMonths) : null,
          },
        });
      }

      created++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await logAudit({
    actor: "human",
    action: "csv_import",
    entityType: "Candidate",
    entityId: "bulk",
    detail: { created, errorCount: errors.length, fileName: (file as File).name },
  });

  return NextResponse.json({ created, errors, totalRows: rows.length });
}
