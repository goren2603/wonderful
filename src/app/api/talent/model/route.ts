import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { FACTORS, zScores, type CandidateRow } from "@/lib/agents/talentAgent";
import { pearsonCorrelation, mean, stddev } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Powers the interactive "change weighting assumptions and immediately see
// ranking impact" control: ships each candidate's standardized factor values
// plus each factor's learned correlation, so the client can recompute a
// weighted ranking instantly without a round trip per slider drag.
export async function GET() {
  const raw = await db.candidate.findMany({ include: { hire: true, performance: true } });
  const rows: CandidateRow[] = raw.map((c) => ({
    id: c.id,
    yearsExperience: c.yearsExperience,
    startupExperience: c.startupExperience,
    technicalDomain: c.technicalDomain,
    originalSourcingScore: c.originalSourcingScore,
    hired: c.hire?.hired ?? false,
    retentionMonths: c.performance?.retentionMonths ?? null,
    managerRating: c.performance?.managerRating ?? null,
  }));

  const hiredRows = rows.filter((r) => r.hired && r.retentionMonths != null && r.managerRating != null);
  const retentionZ = zScores(hiredRows.map((r) => r.retentionMonths as number));
  const ratingZ = zScores(hiredRows.map((r) => r.managerRating as number));
  const successComposite = retentionZ.map((z, i) => (z + ratingZ[i]) / 2);

  const weighable = FACTORS.filter((f) => f.key !== "originalSourcingScore");
  const factorMeta = weighable.map((f) => {
    const x = hiredRows.map((r) => f.extract(r));
    const r = pearsonCorrelation(x, successComposite);
    return { key: f.key, label: f.label, r, n: hiredRows.length };
  });

  const featureCols = weighable.map((f) => rows.map((r) => f.extract(r)));
  const featureZ = featureCols.map((col) => zScores(col));
  const featureMeans = featureCols.map((col) => mean(col));
  const featureStd = featureCols.map((col) => stddev(col) || 1);

  const candidates = raw.map((c, i) => ({
    id: c.id,
    name: c.name,
    originalSourcingScore: c.originalSourcingScore,
    hired: c.hire?.hired ?? false,
    values: Object.fromEntries(weighable.map((f, fi) => [f.key, featureZ[fi][i]])),
  }));

  return NextResponse.json({
    factors: factorMeta,
    featureStats: weighable.map((f, i) => ({ key: f.key, mean: featureMeans[i], std: featureStd[i] })),
    candidates,
  });
}
