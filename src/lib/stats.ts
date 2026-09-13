// Statistics helpers for Talent Intelligence. Deliberately conservative:
// this computes real correlations and sample-size-aware confidence labels,
// but never claims causation and never reports a finding without its n.

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stddev(xs: number[]): number {
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1 || 1);
  return Math.sqrt(variance);
}

/** Pearson correlation coefficient between two equal-length numeric arrays. */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (x.length !== y.length || [...x, ...y].some(v => !Number.isFinite(v))) throw new Error("Correlation requires equal-length finite arrays");
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

/** Two-sided Student-t significance for Pearson correlation; independent normal observations assumed. */
export function approxPValue(r: number, n: number): number {
  if (n < 3) return 1;
  // Student-t two-sided tail via a trigonometric beta integral (Simpson quadrature).
  const integral = (end: number) => {
    const steps = 1024, h = end / steps;
    const f = (x: number) => Math.sin(x) ** (n - 3);
    let sum = f(0) + f(end);
    for (let i=1;i<steps;i++) sum += (i%2 ? 4 : 2)*f(i*h);
    return sum*h/3;
  };
  return Math.max(0, Math.min(1, integral(Math.acos(Math.min(1,Math.abs(r))))/integral(Math.PI/2)));
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

/** Approximate Fisher-z interval; exploratory, assumes independent observations. */
export function correlationInterval(r: number, n: number): [number, number] | null {
  if (n <= 3) return null;
  const z = Math.atanh(Math.max(-.999999, Math.min(.999999, r)));
  const margin = 1.96 / Math.sqrt(n - 3);
  return [Math.tanh(z - margin), Math.tanh(z + margin)];
}

/**
 * Sample-size- and effect-size-aware confidence tier. Small samples are
 * always capped at LOW regardless of how strong the correlation looks —
 * this is the guardrail against overclaiming from noisy small-n patterns.
 */
export function confidenceFromStats(n: number, r: number): ConfidenceLevel {
  const absR = Math.abs(r);
  const ci = correlationInterval(r, n);
  if (!ci || (ci[0] <= 0 && ci[1] >= 0)) return "LOW";
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
