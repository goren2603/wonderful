import { db } from "@/lib/db";
import { getLLMProvider } from "@/lib/llm";
import { REUSABLE_FACTORS, learnModel, evaluateModelVersions, scoreCandidate, HIGH_PERFORMER_DEFINITION, type CandidateRow } from "@/lib/talentModel";
import { pearsonCorrelation, confidenceFromStats, correlationInterval } from "@/lib/stats";
import { withAgentLease } from "@/lib/agentRuntime";
export { REUSABLE_FACTORS, zScores, type CandidateRow } from "@/lib/talentModel";

export async function runTalentAnalysis() {
  return withAgentLease("TALENT_INTELLIGENCE", async () => {
    const run = await db.agentRun.create({ data: { agent: "TALENT_INTELLIGENCE", goal: "Audit Model V1 against real employee outcomes and validate a proposed Model V2" } });
    const steps: { label: string; detail: string; at: string }[] = [];
    const step = async (label: string, detail: string) => {
      steps.push({ label, detail, at: new Date().toISOString() });
      await db.agentRun.update({ where: { id: run.id }, data: { stepsJson: JSON.stringify(steps) } });
    };
    try {
      const raw = await db.candidate.findMany({ include: { hire: true, performance: true }, orderBy: { id: "asc" } });
      const toRow = (c: (typeof raw)[number]): CandidateRow => ({
        ...c,
        hired: c.hire?.hired ?? false,
        retentionMonths: c.performance?.retentionMonths ?? null,
        managerRating: c.performance?.managerRating ?? null,
        highPerformer: c.performance?.highPerformer ?? null,
      });
      const historical = raw.filter((c) => !c.isNewBatch).map(toRow);
      const batch = raw.filter((c) => c.isNewBatch).map(toRow);

      await step("Ingesting outcomes", `${historical.length} historical candidates connected to downstream outcomes (interviewed, hired, tenure, performance). ${batch.length} recent not-yet-decided candidates held out as a demo batch.`);

      // Exploratory correlation list — supporting detail, not the headline.
      const model = learnModel(historical);
      const warnings = ["Correlational, not causal. Retention is not adjusted for tenure opportunity. Geography is excluded from the model."];

      // Headline: does a proposed Model V2 actually beat Model V1 on data
      // neither model was fit to?
      await step("Auditing Model V1", `Comparing what Model V1's score rewards against what real post-hire outcomes show. High performer = ${HIGH_PERFORMER_DEFINITION}.`);
      const evaluation = evaluateModelVersions(historical);
      if (!evaluation.eligible) warnings.push("Fewer than 20 hired candidates with a recorded manager rating and a balanced holdout split: validation skipped, no Model V2 proposed this run.");
      await step(
        "Validating Model V2",
        evaluation.eligible
          ? `Trained on ${evaluation.trainSize} candidates, validated on ${evaluation.holdoutSize} held-out candidates Model V2 never saw. Model V1 precision ${(evaluation.v1Precision * 100).toFixed(0)}%, Model V2 precision ${(evaluation.v2Precision * 100).toFixed(0)}% at top ${evaluation.kUsed}. Status: ${evaluation.validationStatus}.`
          : "Insufficient outcome data for a holdout-validated comparison."
      );

      const narrative = [
        evaluation.eligible
          ? `Model V1 identifies real high performers with ${(evaluation.v1Precision * 100).toFixed(0)}% precision on held-out data. The proposed Model V2 reaches ${(evaluation.v2Precision * 100).toFixed(0)}%, and ${evaluation.validationStatus === "PASSED" ? "outperforms V1, so it is recommended for approval." : "does not outperform V1, so no change is recommended this run."}`
          : "Not enough hired candidates with recorded outcomes yet to validate a proposed model.",
        ...evaluation.factorAudit.slice(0, 3).map((f) => `${f.label}: Model V1 weight ${(f.v1Weight * 100).toFixed(0)}%, recommended ${(f.v2Weight * 100).toFixed(0)}%. ${f.reason}`),
      ].join("\n");
      let llm = { text: narrative, provider: "demo" as "demo" | "live", model: "computed-summary" };
      try {
        llm = await getLLMProvider().complete({ system: "Summarize the supplied holdout-validated model comparison. Never claim causation or invent numbers not given.", prompt: narrative, maxTokens: 300 });
      } catch {
        warnings.push("Narrative provider failed; computed analysis retained.");
      }

      const summary = evaluation.eligible
        ? `Reviewed ${historical.length} candidates (${evaluation.hiresAnalyzed} eventual hires). Model V2 ${evaluation.validationStatus === "PASSED" ? "validated and proposed for approval" : "did not outperform Model V1 — no change proposed"}.`
        : `Reviewed ${historical.length} candidates; insufficient outcome data to validate a proposed model yet.`;

      await step("Persisting results", "Recording the evaluation, factor audit and any batch re-ranking.");
      await db.$transaction(
        async (tx) => {
          for (const f of model.factors) {
            const ci = correlationInterval(f.r, f.n);
            await tx.sourcingInsight.create({
              data: {
                kind: "CORRELATION",
                factor: f.key,
                title: `${f.label} vs. post-hire success`,
                description: `${f.label}: Pearson r=${f.r.toFixed(2)} (n=${f.n}); approximate 95% Fisher interval ${ci ? `[${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]` : "unavailable"}. Success combines standardized retention and manager rating. Association only.`,
                sampleSize: f.n,
                confidence: f.confidence,
                correlation: f.r,
                runId: run.id,
                confoundersJson: JSON.stringify(["Selection bias: hired candidates only", "Role, manager and tenure opportunity not controlled", "Exploratory multiple comparisons", ...(!f.balanced ? ["Fewer than five observations in one factor group"] : [])]),
              },
            });
          }
          const known = raw.filter((c) => !c.isNewBatch && c.hire !== null);
          const rHired = pearsonCorrelation(known.map((c) => c.originalSourcingScore), known.map((c) => Number(c.hire!.hired)));
          await tx.sourcingInsight.create({
            data: {
              kind: "CORRELATION",
              factor: "originalSourcingScore_vs_hired",
              title: "Original sourcing score vs. recorded hire decision",
              description: `${known.length} recorded hiring decisions. r=${rHired.toFixed(2)}.`,
              sampleSize: known.length,
              confidence: confidenceFromStats(known.length, rHired),
              correlation: rHired,
              runId: run.id,
            },
          });

          await tx.sourcingModelEvaluation.create({
            data: {
              runId: run.id,
              candidatesReviewed: evaluation.candidatesReviewed,
              hiresAnalyzed: evaluation.hiresAnalyzed,
              trainSize: evaluation.trainSize,
              holdoutSize: evaluation.holdoutSize,
              kUsed: evaluation.kUsed,
              v1Precision: evaluation.v1Precision,
              v2Precision: evaluation.v2Precision,
              improvementPct: evaluation.improvementPct,
              validationStatus: evaluation.eligible ? evaluation.validationStatus : "INSUFFICIENT_DATA",
              highPerformerDefinition: HIGH_PERFORMER_DEFINITION,
              factorAuditJson: JSON.stringify(evaluation.factorAudit),
            },
          });

          if (evaluation.eligible && evaluation.validationStatus === "PASSED") {
            await tx.sourcingWeightProposal.updateMany({ where: { status: "PENDING" }, data: { status: "SUPERSEDED", decidedAt: new Date() } });
            await tx.approvalItem.updateMany({ where: { kind: "SOURCING_WEIGHT_CHANGE", status: "PENDING" }, data: { status: "SUPERSEDED", decidedAt: new Date() } });
            const payload = { runId: run.id, weights: evaluation.v2Weights, featureStats: evaluation.v2FeatureStats, sampleSize: evaluation.trainSize };
            const proposal = await tx.sourcingWeightProposal.create({
              data: {
                factor: "Model V2 (validated)",
                oldWeight: 0,
                newWeight: 1,
                rationale: `Validated on ${evaluation.holdoutSize} held-out candidates: ${(evaluation.v1Precision * 100).toFixed(0)}% → ${(evaluation.v2Precision * 100).toFixed(0)}% high-performer precision (+${evaluation.improvementPct?.toFixed(1) ?? "?"}%). ` + Object.entries(evaluation.v2Weights).map(([k, v]) => `${k}: ${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`).join(", "),
                status: "PENDING",
              },
            });
            await tx.approvalItem.create({ data: { kind: "SOURCING_WEIGHT_CHANGE", entityType: "SourcingWeightProposal", entityId: proposal.id, title: "Promote Model V2 to active", payloadJson: JSON.stringify(payload) } });
            await tx.auditLogEntry.create({ data: { actor: "agent", action: "model_v2_proposed", entityType: "AgentRun", entityId: run.id, detailJson: JSON.stringify(payload) } });
          }

          // Re-rank the new, not-yet-decided batch with the validated V2
          // weights (train-fold only — exactly what was validated). Prior
          // versions are kept (never deleted) so each candidate's ranking
          // history stays inspectable across analysis runs; the summary API
          // shows only the latest run's snapshot.
          if (evaluation.eligible && batch.length > 0) {
            const byV1 = [...batch].sort((a, b) => b.originalSourcingScore - a.originalSourcingScore || a.id.localeCompare(b.id));
            const byV2 = [...batch].map((c) => ({ c, score: scoreCandidate(c, evaluation.v2Weights, evaluation.v2FeatureStats) })).sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
            for (const [i, { c, score }] of byV2.entries()) {
              const reasons = REUSABLE_FACTORS.map((f) => {
                const s = evaluation.v2FeatureStats.find((s) => s.key === f.key)!;
                const z = (f.extract(c) - s.mean) / s.std;
                return { factor: f.label, contribution: (evaluation.v2Weights[f.key] ?? 0) * z, detail: `${f.label}: V2 weight ${((evaluation.v2Weights[f.key] ?? 0) * 100).toFixed(0)}%, this candidate's standardized value ${z.toFixed(2)}` };
              }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
              await tx.learnedRanking.create({
                data: {
                  candidateId: c.id,
                  oldRank: byV1.findIndex((o) => o.id === c.id) + 1,
                  newRank: i + 1,
                  oldScore: c.originalSourcingScore,
                  newScore: Math.round(score * 100) / 100,
                  reasonJson: JSON.stringify(reasons),
                  generatedAt: run.startedAt,
                },
              });
            }
          }

          await tx.agentRun.update({
            where: { id: run.id },
            data: {
              status: "SUCCEEDED",
              endedAt: new Date(),
              durationMs: Date.now() - run.startedAt.getTime(),
              sourcesChecked: historical.length,
              entitiesFound: historical.length,
              entitiesAccepted: evaluation.hiresAnalyzed,
              actionsCreated: (evaluation.validationStatus === "PASSED" ? 1 : 0) + batch.length,
              summary,
              llmSummary: llm.text,
              llmProvider: llm.provider,
              llmModel: llm.model,
              warningsJson: JSON.stringify(warnings),
              stepsJson: JSON.stringify(steps),
            },
          });
        },
        { timeout: 30000 }
      );
      return { runId: run.id, validationStatus: evaluation.validationStatus };
    } catch (err) {
      await db.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", endedAt: new Date(), durationMs: Date.now() - run.startedAt.getTime(), errorMessage: err instanceof Error ? err.message : String(err) } });
      throw err;
    }
  });
}
