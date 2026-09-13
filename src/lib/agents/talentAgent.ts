import { db } from "@/lib/db";
import { pearsonCorrelation, confidenceFromStats, mean, stddev } from "@/lib/stats";
import { getLLMProvider } from "@/lib/llm";
import type { AgentStep, WeightReason } from "@/lib/types";

interface Factor {
  key: string;
  label: string;
  extract: (c: CandidateRow) => number;
}

export interface CandidateRow {
  id: string;
  yearsExperience: number;
  startupExperience: boolean;
  technicalDomain: string;
  originalSourcingScore: number;
  hired: boolean;
  retentionMonths: number | null;
  managerRating: number | null;
}

export const FACTORS: Factor[] = [
  { key: "yearsExperience", label: "Years of experience", extract: (c) => c.yearsExperience },
  { key: "startupExperience", label: "Startup experience", extract: (c) => (c.startupExperience ? 1 : 0) },
  {
    key: "highSignalDomain",
    label: "Backend / Data-ML domain",
    extract: (c) => (c.technicalDomain === "Backend" || c.technicalDomain === "Data/ML" ? 1 : 0),
  },
  { key: "originalSourcingScore", label: "Original sourcing score", extract: (c) => c.originalSourcingScore },
];

export function zScores(xs: number[]): number[] {
  const m = mean(xs);
  const sd = stddev(xs) || 1;
  return xs.map((x) => (x - m) / sd);
}

export async function runTalentAnalysis() {
  const startedAt = new Date();
  const steps: AgentStep[] = [];
  const pushStep = (label: string, detail: string) =>
    steps.push({ label, detail, at: new Date().toISOString() });

  const run = await db.agentRun.create({
    data: { agent: "TALENT_INTELLIGENCE", goal: "Analyze sourced-candidate outcomes for sourcing signal", status: "RUNNING" },
  });

  try {
    pushStep("Loading history", "Pulling candidate, interview, hire, and performance records.");
    const rawCandidates = await db.candidate.findMany({
      include: { hire: true, performance: true },
    });

    const rows: CandidateRow[] = rawCandidates.map((c) => ({
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

    pushStep(
      "Statistical analysis",
      `Computing correlations across ${FACTORS.length} factors against retention and manager rating (n=${hiredRows.length} hired candidates with outcome data).`
    );

    await db.sourcingInsight.deleteMany({});
    await db.learnedRanking.deleteMany({});
    await db.sourcingWeightProposal.deleteMany({ where: { status: "PENDING" } });

    const retentionZ = zScores(hiredRows.map((r) => r.retentionMonths as number));
    const ratingZ = zScores(hiredRows.map((r) => r.managerRating as number));
    const successComposite = retentionZ.map((z, i) => (z + ratingZ[i]) / 2);

    const factorCorrelations: { factor: Factor; r: number; n: number }[] = [];

    for (const factor of FACTORS) {
      const x = hiredRows.map((r) => factor.extract(r));
      const r = pearsonCorrelation(x, successComposite);
      const n = hiredRows.length;
      factorCorrelations.push({ factor, r, n });

      const confidence = confidenceFromStats(n, r);
      const direction = r > 0 ? "positively" : "negatively";
      await db.sourcingInsight.create({
        data: {
          kind: "CORRELATION",
          factor: factor.key,
          title: `${factor.label} correlates ${direction} with post-hire success`,
          description: `Among ${n} hired candidates with recorded outcomes, ${factor.label.toLowerCase()} shows a Pearson correlation of r=${r.toFixed(
            2
          )} with a composite of retention and manager rating. This is an observed correlation, not a causal claim — other unmeasured factors (team, manager, role) likely contribute.`,
          sampleSize: n,
          confidence,
          correlation: r,
          confoundersJson: JSON.stringify([
            "Manager and team assignment not controlled for",
            "Role/level differences across candidates",
            n < 50 ? "Small sample size limits reliability" : "Sample size is moderate; treat as directional",
          ]),
          runId: run.id,
        },
      });
    }

    // Original sourcing score's own predictive power, as a baseline comparison.
    const sourcingVsHired = pearsonCorrelation(
      rows.map((r) => r.originalSourcingScore),
      rows.map((r) => (r.hired ? 1 : 0))
    );
    await db.sourcingInsight.create({
      data: {
        kind: "CORRELATION",
        factor: "originalSourcingScore_vs_hired",
        title: "Original sourcing score vs. actual hire outcome",
        description: `Across all ${rows.length} sourced candidates, the original AI sourcing score correlates with r=${sourcingVsHired.toFixed(
          2
        )} with whether the candidate was ultimately hired. This measures how well the current sourcing score predicts downstream hiring, independent of performance after hire.`,
        sampleSize: rows.length,
        confidence: confidenceFromStats(rows.length, sourcingVsHired),
        correlation: sourcingVsHired,
        confoundersJson: JSON.stringify(["Interview process quality not isolated from sourcing quality"]),
        runId: run.id,
      },
    });

    pushStep("Feature importance", "Ranking factors by absolute correlation strength to derive learned weights.");

    // Learned weights: normalize absolute correlation among the reusable
    // pre-hire factors (exclude the raw sourcing score itself from being its
    // own replacement weight) into a weight vector summing to 1.
    const weighable = factorCorrelations.filter((f) => f.factor.key !== "originalSourcingScore");
    const totalAbsR = weighable.reduce((a, f) => a + Math.abs(f.r), 0) || 1;
    const learnedWeights = weighable.map((f) => ({
      factor: f.factor,
      weight: Math.abs(f.r) / totalAbsR,
      r: f.r,
      n: f.n,
    }));

    const oldWeight = 1 / weighable.length;
    for (const w of learnedWeights) {
      const changedEnough = Math.abs(w.weight - oldWeight) > 0.03;
      if (!changedEnough) continue;
      await db.sourcingWeightProposal.create({
        data: {
          factor: w.factor.key,
          oldWeight: Math.round(oldWeight * 100) / 100,
          newWeight: Math.round(w.weight * 100) / 100,
          rationale: `${w.factor.label} shows r=${w.r.toFixed(2)} with post-hire success (n=${w.n}), ${
            w.weight > oldWeight ? "stronger" : "weaker"
          } than an equal-weight baseline suggests. Proposing to ${
            w.weight > oldWeight ? "increase" : "decrease"
          } its weight in the sourcing score accordingly.`,
          status: "PENDING",
        },
      });

      await db.sourcingInsight.create({
        data: {
          kind: "RECOMMENDATION",
          factor: w.factor.key,
          title: `Consider ${w.weight > oldWeight ? "increasing" : "decreasing"} weight on ${w.factor.label.toLowerCase()}`,
          description: `Based on observed correlation with post-hire success (r=${w.r.toFixed(2)}, n=${w.n}), an equal-weight baseline may be ${
            w.weight > oldWeight ? "under" : "over"
          }-weighting this factor. This is a recommendation pending human approval, not an automatic change.`,
          sampleSize: w.n,
          confidence: confidenceFromStats(w.n, w.r),
          correlation: w.r,
          confoundersJson: JSON.stringify(["Recommendation derived from correlational data; requires human review before applying"]),
          runId: run.id,
        },
      });
    }

    pushStep("Re-ranking", "Applying learned weights to produce a proposed candidate ranking.");

    // Build a learned score for every candidate using only pre-hire-available
    // features, weighted by the learned weights above.
    const allFeatureMatrix = learnedWeights.map((w) => rows.map((r) => w.factor.extract(r)));
    const allFeatureZ = allFeatureMatrix.map((col) => zScores(col));

    const learnedScoresRaw = rows.map((_, i) =>
      learnedWeights.reduce((sum, w, fi) => sum + w.weight * allFeatureZ[fi][i] * Math.sign(w.r || 1), 0)
    );
    const minRaw = Math.min(...learnedScoresRaw);
    const maxRaw = Math.max(...learnedScoresRaw);
    const learnedScores100 = learnedScoresRaw.map((s) =>
      Math.round((((s - minRaw) / (maxRaw - minRaw || 1)) * 60 + 40) * 10) / 10
    );

    const byOldScoreDesc = [...rows]
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.originalSourcingScore - a.r.originalSourcingScore);
    const oldRankOf = new Map<string, number>();
    byOldScoreDesc.forEach(({ r }, idx) => oldRankOf.set(r.id, idx + 1));

    const byNewScoreDesc = [...rows]
      .map((r, i) => ({ r, i, score: learnedScores100[i] }))
      .sort((a, b) => b.score - a.score);

    let actionsCreated = 0;
    for (let rank = 0; rank < byNewScoreDesc.length; rank++) {
      const { r, i, score } = byNewScoreDesc[rank];
      const reasons: WeightReason[] = learnedWeights
        .map((w, fi) => ({
          factor: w.factor.label,
          contribution: Math.round(w.weight * allFeatureZ[fi][i] * Math.sign(w.r || 1) * 100) / 100,
          detail: `${w.factor.label}: weight ${(w.weight * 100).toFixed(0)}%, this candidate's standardized value ${allFeatureZ[fi][i].toFixed(2)}`,
        }))
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

      await db.learnedRanking.create({
        data: {
          candidateId: r.id,
          oldRank: oldRankOf.get(r.id) ?? 0,
          newRank: rank + 1,
          oldScore: r.originalSourcingScore,
          newScore: score,
          reasonJson: JSON.stringify(reasons),
          generatedAt: new Date(),
        },
      });
      actionsCreated++;
    }

    pushStep("LLM interpretation", "Composing a narrative interpretation of the strongest findings.");
    const topFindings = factorCorrelations
      .slice()
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
      .slice(0, 3);
    const narrativePrompt = [
      `Sourcing analysis over ${rows.length} candidates (${hiredRows.length} hired with full outcome data):`,
      ...topFindings.map(
        (f) =>
          `- ${f.factor.label}: r=${f.r.toFixed(2)} with post-hire success (n=${f.n}, ${confidenceFromStats(f.n, f.r).toLowerCase()} confidence).`
      ),
      learnedWeights.length > 0
        ? `Proposed weight changes affect ${learnedWeights.filter((w) => Math.abs(w.weight - oldWeight) > 0.03).length} factor(s), pending human approval.`
        : "No material weight changes proposed this run.",
      "These are observed correlations only, not causal claims — confounders like manager, team, and role are not controlled for.",
    ].join("\n");
    const llmResult = await getLLMProvider().complete({
      system: "You interpret recruiting analytics for a talent operations team. Be precise about sample sizes and confidence, never claim causation.",
      prompt: narrativePrompt,
      maxTokens: 300,
    });

    const durationMs = Date.now() - startedAt.getTime();
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        endedAt: new Date(),
        durationMs,
        sourcesChecked: rows.length,
        entitiesFound: rows.length,
        entitiesAccepted: rows.length,
        actionsCreated,
        stepsJson: JSON.stringify(steps),
        summary: `Analyzed ${rows.length} candidates (${hiredRows.length} with full outcome data), produced ${factorCorrelations.length + 1} correlation findings and a re-ranking for ${actionsCreated} candidates.`,
        llmSummary: llmResult.text,
        llmProvider: llmResult.provider,
        llmModel: llmResult.model,
      },
    });

    return { runId: run.id };
  } catch (err) {
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        endedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
        stepsJson: JSON.stringify(steps),
      },
    });
    throw err;
  }
}
