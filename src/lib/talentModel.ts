import { pearsonCorrelation, mean, stddev, confidenceFromStats } from "./stats";

export interface CandidateRow {
  id: string;
  yearsExperience: number;
  startupExperience: boolean; // "0→1 startup experience"
  eliteUniversity: boolean;
  priorLeadership: boolean;
  technicalDomain: string;
  originalSourcingScore: number; // Model V1 output
  hired: boolean;
  retentionMonths: number | null;
  managerRating: number | null;
  highPerformer: boolean | null; // managerRating >= 4.0; null if unknown/not hired
}

export const HIGH_PERFORMER_DEFINITION = "Hired, with a recorded manager rating of 4.0 or higher out of 5";

export const FACTORS = [
  { key: "yearsExperience", label: "Years of experience", extract: (c: CandidateRow) => c.yearsExperience },
  { key: "startupExperience", label: "0→1 startup experience", extract: (c: CandidateRow) => Number(c.startupExperience) },
  { key: "eliteUniversity", label: "Elite university background", extract: (c: CandidateRow) => Number(c.eliteUniversity) },
  { key: "priorLeadership", label: "Prior leadership experience", extract: (c: CandidateRow) => Number(c.priorLeadership) },
  { key: "highSignalDomain", label: "Backend / Data-ML domain", extract: (c: CandidateRow) => Number(["Backend", "Data/ML"].includes(c.technicalDomain)) },
  { key: "originalSourcingScore", label: "Original sourcing score", extract: (c: CandidateRow) => c.originalSourcingScore },
];
export const REUSABLE_FACTORS = FACTORS.filter((f) => f.key !== "originalSourcingScore");

export const zScores = (xs: number[]) => {
  const m = mean(xs), sd = stddev(xs) || 1;
  return xs.map((x) => (x - m) / sd);
};

const isBinaryFactor = (key: string) => ["startupExperience", "eliteUniversity", "priorLeadership", "highSignalDomain"].includes(key);

function balancedEnough(x: number[], key: string): boolean {
  if (!isBinaryFactor(key)) return true;
  return Math.min(x.filter((v) => v === 0).length, x.filter((v) => v === 1).length) >= 5;
}

export function learnModel(rows: CandidateRow[]) {
  const outcomes = rows.filter((c) => c.hired && c.retentionMonths != null && c.managerRating != null);
  const retention = zScores(outcomes.map((c) => c.retentionMonths!));
  const rating = zScores(outcomes.map((c) => c.managerRating!));
  const y = retention.map((z, i) => (z + rating[i]) / 2);
  const factors = FACTORS.map((f) => {
    const x = outcomes.map(f.extract);
    const r = pearsonCorrelation(x, y);
    const balanced = balancedEnough(x, f.key);
    return { key: f.key, label: f.label, r, n: y.length, confidence: balanced ? confidenceFromStats(y.length, r) : ("LOW" as const), balanced };
  });
  const reusable = factors.filter((f) => f.key !== "originalSourcingScore");
  const eligible = outcomes.length >= 20 && stddev(y) > 0 && reusable.some((f) => f.balanced && Math.abs(f.r) >= 0.1);
  const total = reusable.reduce((s, f) => s + (f.balanced ? Math.abs(f.r) : 0), 0) || 1;
  const weights = Object.fromEntries(reusable.map((f) => [f.key, eligible && f.balanced ? f.r / total : 0]));
  const featureStats = REUSABLE_FACTORS.map((f) => ({ key: f.key, mean: mean(rows.map(f.extract)), std: stddev(rows.map(f.extract)) || 1 }));
  const scores = rows.map((c) => scoreCandidate(c, weights, featureStats));
  return { factors, weights, featureStats, scores, eligible, sampleSize: outcomes.length };
}

export function scoreCandidate(c: CandidateRow, weights: Record<string, number>, stats: { key: string; mean: number; std: number }[]) {
  return REUSABLE_FACTORS.reduce((sum, f) => {
    const stat = stats.find((s) => s.key === f.key);
    return sum + (weights[f.key] ?? 0) * (stat ? (f.extract(c) - stat.mean) / stat.std : 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────
// Model V1 vs proposed Model V2 — holdout-validated precision
// ─────────────────────────────────────────────────────────────

/** Deterministic (not random) train/holdout split so results are reproducible across runs. Every 3rd row (by stable id order) goes to holdout. */
export function splitHoldout<T extends { id: string }>(rows: T[]): { train: T[]; holdout: T[] } {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const train: T[] = [], holdout: T[] = [];
  sorted.forEach((r, i) => (i % 3 === 2 ? holdout : train).push(r));
  return { train, holdout };
}

/** Fraction of the top-K rows by `scoreOf` that satisfy `isHighPerformer`. */
export function precisionAtK<T>(rows: T[], scoreOf: (r: T) => number, isHighPerformer: (r: T) => boolean, k: number): number {
  if (k <= 0 || rows.length === 0) return 0;
  const top = [...rows].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, k);
  return top.filter(isHighPerformer).length / top.length;
}

/** Normalizes a set of {key, r} pairs into signed weights that sum (in absolute value) to 1. */
function normalizeWeights(entries: { key: string; r: number; balanced: boolean }[]): Record<string, number> {
  const total = entries.reduce((s, e) => s + (e.balanced ? Math.abs(e.r) : 0), 0) || 1;
  return Object.fromEntries(entries.map((e) => [e.key, e.balanced ? e.r / total : 0]));
}

export interface FactorAuditRow {
  key: string;
  label: string;
  v1Weight: number; // -1..1, signed share of V1's own score this factor explains
  v2Weight: number; // -1..1, signed share of the proposed model driven by true outcomes
  v1ProgressionR: number; // correlation with reaching a hired decision (what V1 effectively selected for)
  v2OutcomeR: number; // correlation with high-performer outcome, train fold only
  reason: string;
}

export interface ModelEvaluation {
  eligible: boolean;
  candidatesReviewed: number;
  hiresAnalyzed: number;
  trainSize: number;
  holdoutSize: number;
  kUsed: number;
  v1Precision: number;
  v2Precision: number;
  improvementPct: number | null;
  validationStatus: "PASSED" | "FAILED" | "INSUFFICIENT_DATA";
  factorAudit: FactorAuditRow[];
  v2Weights: Record<string, number>;
  v2FeatureStats: { key: string; mean: number; std: number }[];
}

function strength(absR: number): "strong" | "moderate" | "weak" {
  if (absR >= 0.3) return "strong";
  if (absR >= 0.15) return "moderate";
  return "weak";
}

/**
 * Compares Model V1 (the existing originalSourcingScore) against a proposed
 * Model V2 learned ONLY from the train fold, validated on a held-out fold
 * V2 never saw. Only ever call this "PASSED" if V2's precision at
 * identifying real high performers beats V1's on that untouched holdout.
 */
export function evaluateModelVersions(allRows: CandidateRow[]): ModelEvaluation {
  const historical = allRows; // caller passes only non-batch rows
  const withDecision = historical.filter((c) => c.hired !== null && c.hired !== undefined);
  const outcomeKnown = historical.filter((c) => c.hired && c.managerRating != null);

  const empty: ModelEvaluation = {
    eligible: false,
    candidatesReviewed: historical.length,
    hiresAnalyzed: outcomeKnown.length,
    trainSize: 0,
    holdoutSize: 0,
    kUsed: 0,
    v1Precision: 0,
    v2Precision: 0,
    improvementPct: null,
    validationStatus: "INSUFFICIENT_DATA",
    factorAudit: [],
    v2Weights: {},
    v2FeatureStats: [],
  };
  if (outcomeKnown.length < 20) return empty;

  const { train, holdout } = splitHoldout(outcomeKnown);
  if (holdout.length < 8 || train.length < 12) return empty;

  // V1 implied weights: what does V1's own score actually reward, measured
  // across every candidate with a recorded hire decision (not just outcome
  // — this is about what V1 selected for, independent of what happened
  // after).
  const v1Entries = REUSABLE_FACTORS.map((f) => {
    const x = withDecision.map(f.extract);
    const r = pearsonCorrelation(x, withDecision.map((c) => c.originalSourcingScore));
    return { key: f.key, label: f.label, r, balanced: balancedEnough(x, f.key) };
  });
  const v1Weights = normalizeWeights(v1Entries);

  // What actually predicted reaching a hire decision at all (the
  // "interview progression" signal V1 effectively selected on).
  const v1ProgressionR = Object.fromEntries(
    REUSABLE_FACTORS.map((f) => [f.key, pearsonCorrelation(withDecision.map(f.extract), withDecision.map((c) => Number(c.hired)))])
  );

  // V2 learned weights: fit ONLY on the train fold, against the real
  // high-performer label.
  const v2Entries = REUSABLE_FACTORS.map((f) => {
    const x = train.map(f.extract);
    const r = pearsonCorrelation(x, train.map((c) => Number(c.highPerformer)));
    return { key: f.key, label: f.label, r, balanced: balancedEnough(x, f.key) };
  });
  const v2Weights = normalizeWeights(v2Entries);
  const v2FeatureStats = REUSABLE_FACTORS.map((f) => ({ key: f.key, mean: mean(train.map(f.extract)), std: stddev(train.map(f.extract)) || 1 }));

  const k = Math.max(1, Math.floor(holdout.length / 2));
  const v1Precision = precisionAtK(holdout, (c) => c.originalSourcingScore, (c) => Boolean(c.highPerformer), k);
  const v2Precision = precisionAtK(holdout, (c) => scoreCandidate(c, v2Weights, v2FeatureStats), (c) => Boolean(c.highPerformer), k);
  const improvementPct = v1Precision > 0 ? ((v2Precision - v1Precision) / v1Precision) * 100 : v2Precision > 0 ? 100 : 0;

  const factorAudit: FactorAuditRow[] = REUSABLE_FACTORS.map((f) => {
    const v1r = v1Entries.find((e) => e.key === f.key)!.r;
    const v2r = v2Entries.find((e) => e.key === f.key)!.r;
    const progR = v1ProgressionR[f.key];
    const reason = `${strength(Math.abs(progR))[0].toUpperCase()}${strength(Math.abs(progR)).slice(1)} relationship with interview progression (r=${progR.toFixed(2)}), ${strength(Math.abs(v2r))} relationship with post-hire performance (r=${v2r.toFixed(2)}, train n=${train.length}).`;
    return { key: f.key, label: f.label, v1Weight: v1Weights[f.key] ?? 0, v2Weight: v2Weights[f.key] ?? 0, v1ProgressionR: progR, v2OutcomeR: v2r, reason };
  }).sort((a, b) => Math.abs(b.v1Weight - b.v2Weight) - Math.abs(a.v1Weight - a.v2Weight));

  return {
    eligible: true,
    candidatesReviewed: historical.length,
    hiresAnalyzed: outcomeKnown.length,
    trainSize: train.length,
    holdoutSize: holdout.length,
    kUsed: k,
    v1Precision,
    v2Precision,
    improvementPct,
    validationStatus: v2Precision > v1Precision ? "PASSED" : "FAILED",
    factorAudit,
    v2Weights,
    v2FeatureStats,
  };
}
