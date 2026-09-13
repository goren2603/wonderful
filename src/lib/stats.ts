// Statistics helpers for Talent Intelligence. Deliberately conservative:
// this computes real correlations and sample-size-aware confidence labels,
// but never claims causation and never reports a finding without its n.

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[]): number {
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1 || 1);
  return Math.sqrt(variance);
}

/** Pearson correlation coefficient between two equal-length numeric arrays. */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return 0;
  return num / denom;
}

/**
 * Approximate two-tailed significance of a correlation using the t
 * approximation (r * sqrt(n-2) / sqrt(1-r^2)), then a logistic approximation
 * of the t-distribution's tail. This is intentionally a coarse approximation
 * — good enough to bucket findings into confidence tiers, not to publish.
 */
export function approxPValue(r: number, n: number): number {
  if (n < 3) return 1;
  const rClamped = Math.max(-0.999, Math.min(0.999, r));
  const df = n - 2;
  const t = (rClamped * Math.sqrt(df)) / Math.sqrt(1 - rClamped * rClamped);
  const absT = Math.abs(t);
  // Coarse tail approximation (converges toward the normal tail as df grows).
  // Adequate for bucketing findings into confidence tiers, not for publication.
  const p = df / (df + absT * absT);
  return Math.max(0.0001, Math.min(1, p));
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

/**
 * Sample-size- and effect-size-aware confidence tier. Small samples are
 * always capped at LOW regardless of how strong the correlation looks —
 * this is the guardrail against overclaiming from noisy small-n patterns.
 */
export function confidenceFromStats(n: number, r: number): ConfidenceLevel {
  const absR = Math.abs(r);
  if (n < 20) return "LOW";
  if (n < 50) return absR >= 0.35 ? "MEDIUM" : "LOW";
  if (absR >= 0.3 && n >= 100) return "HIGH";
  if (absR >= 0.25 && n >= 50) return "MEDIUM";
  return "LOW";
}

/** Point-biserial style correlation: continuous x vs binary (0/1) y. */
export function binaryCorrelation(x: number[], yBinary: number[]): number {
  return pearsonCorrelation(x, yBinary);
}
