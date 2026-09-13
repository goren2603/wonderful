// Synthetic (clearly demo) candidate history for the Sourcing Optimizer.
//
// Generated with two DIFFERENT, deliberately only-partly-overlapping signal
// mixes so the audit has something real to find — not hand-picked per
// insight:
//
//   sourcingDriver — what Model V1 (originalSourcingScore) rewards, and what
//   actually got a candidate through the interview process in this dataset's
//   history: elite-university background, years of experience, a
//   high-signal technical domain.
//
//   trueQualityDriver — what actually predicts what happened AFTER hire
//   (retention, manager rating, promotion, high-performer outcome): prior
//   leadership experience and 0→1 startup experience, plus a much smaller
//   contribution from years of experience. Elite-university background is
//   deliberately NOT part of this mix — by construction it has ~zero true
//   relationship to post-hire success, even though it strongly influenced
//   who got hired. That gap is exactly what the audit is supposed to find.

export interface SeedCandidate {
  name: string;
  currentTitle: string;
  yearsExperience: number;
  education: string;
  previousCompanies: string[];
  startupExperience: boolean; // "0→1 startup experience"
  eliteUniversity: boolean;
  priorLeadership: boolean;
  technicalDomain: string;
  geography: string;
  originalSourcingScore: number;
  interviewStage: "Final" | "Onsite" | "Screen" | "Withdrawn";
  interviewOutcome: "PASSED" | "FAILED" | "WITHDRAWN";
  hired: boolean;
  rejectionReason?: string;
  retentionMonths?: number;
  managerRating?: number; // 1..5
  promotionVelocityMonths?: number;
  promotions?: number;
  stillEmployed?: boolean;
  department?: string;
  roleHiredInto?: string;
  currentRole?: string;
  highPerformer?: boolean;
}

const FIRST_NAMES = [
  "Maya", "Liam", "Sofia", "Noah", "Elena", "Marco", "Priya", "Jonas", "Amara", "Lucas",
  "Ines", "Felix", "Nadia", "Tomas", "Yuki", "Omar", "Clara", "Viktor", "Leila", "Sven",
  "Ana", "Dario", "Hana", "Pieter", "Zara", "Milan", "Freya", "Kwame", "Ingrid", "Rafael",
  "Chloe", "Anders", "Mei", "Jamal", "Saoirse", "Bruno", "Lotte", "Théo", "Isabel", "Karim",
];
const LAST_NAMES = [
  "Berg", "Novak", "Haas", "Rossi", "Kowalski", "Dubois", "Larsen", "Fischer", "Silva", "Meyer",
  "Kaplan", "Brandt", "Costa", "Schulz", "Weiss", "Lindqvist", "Moreau", "Adler", "Bakker", "Ferreira",
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOMAINS = ["Backend", "Frontend", "Data/ML", "DevOps/Infra", "Mobile", "Full-stack"];
const GEOS = ["Germany", "United Kingdom", "France", "Netherlands", "Remote-EU"];
const EDUCATION_ELITE = ["MSc Computer Science (top-20 global program)", "PhD (top-20 global program)"];
const EDUCATION_OTHER = ["BSc Computer Science", "MSc Computer Science", "Bootcamp", "Self-taught", "BSc Engineering"];
const COMPANIES = [
  "Deutsche Telekom", "Spotify", "Klarna", "N26", "Zalando", "Booking.com", "Revolut", "Adyen",
  "SAP", "small startup (seed stage)", "small startup (Series A)", "Siemens", "Delivery Hero",
  "local agency", "freelance", "Amazon", "Google", "Criteo", "Contentful", "GetYourGuide",
];
const DEPARTMENT_BY_DOMAIN: Record<string, string> = {
  Backend: "Engineering", "DevOps/Infra": "Platform Engineering", "Data/ML": "Data & Analytics",
  Frontend: "Product Engineering", Mobile: "Product Engineering", "Full-stack": "Engineering",
};

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v));
}

function makeGenerator(seed: number) {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (min: number, max: number) => min + rand() * (max - min);
  const chance = (p: number) => rand() < p;
  return { rand, pick, between, chance };
}

/** Historical candidates: full pre-hire profile plus (for hired candidates) real post-hire outcomes. */
export function generateSeedCandidates(count = 400): SeedCandidate[] {
  const { pick, between, chance } = makeGenerator(20260913);
  const out: SeedCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const startupExperience = chance(0.35);
    const eliteUniversity = chance(0.3);
    const priorLeadership = chance(0.35);
    const yearsExperience = Math.round(between(0.5, 16) * 10) / 10;
    const domain = pick(DOMAINS);
    const geography = pick(GEOS);
    const education = eliteUniversity ? pick(EDUCATION_ELITE) : pick(EDUCATION_OTHER);
    const numPrev = Math.floor(between(1, 4));
    const previousCompanies = Array.from({ length: numPrev }, () => pick(COMPANIES));

    // What Model V1 rewards, and what actually got candidates through the
    // process historically.
    const sourcingDriver =
      (eliteUniversity ? 1.6 : 0) +
      Math.min(yearsExperience, 10) * 0.15 +
      (domain === "Data/ML" || domain === "Backend" ? 0.3 : 0) +
      between(-1, 1);

    const originalSourcingScore = Math.round(clamp(40, 98, 55 + sourcingDriver * 7 + between(-10, 10)));

    // What actually predicts post-hire success. Deliberately excludes
    // eliteUniversity.
    const trueQuality =
      (priorLeadership ? 1.3 : 0) +
      (startupExperience ? 1.1 : 0) +
      Math.min(yearsExperience, 8) * 0.08 +
      between(-1.6, 1.6);

    const passedScreen = chance(clamp(0.05, 0.95, 0.55 + sourcingDriver * 0.08));
    let interviewStage: SeedCandidate["interviewStage"] = "Screen";
    let interviewOutcome: SeedCandidate["interviewOutcome"] = "FAILED";
    let hired = false;
    let rejectionReason: string | undefined;

    if (passedScreen) {
      const passedOnsite = chance(clamp(0.05, 0.95, 0.45 + sourcingDriver * 0.07));
      interviewStage = "Onsite";
      if (passedOnsite) {
        const passedFinal = chance(clamp(0.05, 0.95, 0.5 + sourcingDriver * 0.05));
        interviewStage = "Final";
        if (passedFinal) {
          interviewOutcome = "PASSED";
          hired = chance(0.75);
          if (!hired) rejectionReason = pick(["Offer declined", "Budget freeze", "Chose another offer"]);
        } else {
          interviewOutcome = chance(0.15) ? "WITHDRAWN" : "FAILED";
          rejectionReason = interviewOutcome === "FAILED" ? "Final round signal too mixed" : "Candidate withdrew";
        }
      } else {
        interviewOutcome = chance(0.1) ? "WITHDRAWN" : "FAILED";
        rejectionReason = interviewOutcome === "FAILED" ? "Onsite signal below bar" : "Candidate withdrew";
      }
    } else {
      rejectionReason = pick(["Screen: experience mismatch", "Screen: comp expectations", "Screen: domain gap"]);
    }

    let retentionMonths: number | undefined;
    let managerRating: number | undefined;
    let promotionVelocityMonths: number | undefined;
    let promotions: number | undefined;
    let stillEmployed: boolean | undefined;
    let department: string | undefined;
    let roleHiredInto: string | undefined;
    let currentRole: string | undefined;
    let highPerformer: boolean | undefined;

    if (hired) {
      retentionMonths = Math.round(clamp(1, 48, 9 + trueQuality * 3.2 + between(-6, 8)) * 10) / 10;
      managerRating = Math.round(clamp(1, 5, 2.4 + trueQuality * 0.55 + between(-0.7, 0.7)) * 10) / 10;
      highPerformer = managerRating >= 4;
      promotions = chance(clamp(0.05, 0.7, 0.15 + Math.max(0, trueQuality) * 0.15)) ? (chance(0.75) ? 1 : 2) : 0;
      if (promotions > 0 && retentionMonths > 9) {
        promotionVelocityMonths = Math.round(clamp(6, 30, 20 - trueQuality * 2.5 + between(-4, 4)));
      } else {
        promotions = 0;
      }
      stillEmployed = chance(clamp(0.35, 0.95, 0.55 + trueQuality * 0.1));
      department = DEPARTMENT_BY_DOMAIN[domain] ?? "Engineering";
      roleHiredInto = `${domain} Engineer`;
      currentRole = stillEmployed ? (promotions > 0 ? `Senior ${domain} Engineer` : roleHiredInto) : undefined;
    }

    out.push({
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      currentTitle: `${domain} Engineer`,
      yearsExperience,
      education,
      previousCompanies,
      startupExperience,
      eliteUniversity,
      priorLeadership,
      technicalDomain: domain,
      geography,
      originalSourcingScore,
      interviewStage,
      interviewOutcome,
      hired,
      rejectionReason,
      retentionMonths,
      managerRating,
      promotionVelocityMonths,
      promotions,
      stillEmployed,
      department,
      roleHiredInto,
      currentRole,
      highPerformer,
    });
  }
  return out;
}

/**
 * A recent, not-yet-decided batch of sourced candidates: pre-hire profile
 * only, no interview/hire/performance data (their outcome isn't known yet —
 * that's the point). Used to demo Model V1 vs the proposed Model V2 ranking
 * a real incoming batch differently. Uses a different seed so it isn't a
 * copy of the historical population, but the same generative model.
 */
export function generateNewBatch(count = 24): SeedCandidate[] {
  const { pick, between, chance } = makeGenerator(7261994);
  const out: SeedCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const startupExperience = chance(0.35);
    const eliteUniversity = chance(0.3);
    const priorLeadership = chance(0.35);
    const yearsExperience = Math.round(between(0.5, 16) * 10) / 10;
    const domain = pick(DOMAINS);
    const geography = pick(GEOS);
    const education = eliteUniversity ? pick(EDUCATION_ELITE) : pick(EDUCATION_OTHER);
    const numPrev = Math.floor(between(1, 4));
    const previousCompanies = Array.from({ length: numPrev }, () => pick(COMPANIES));
    const sourcingDriver =
      (eliteUniversity ? 1.6 : 0) +
      Math.min(yearsExperience, 10) * 0.15 +
      (domain === "Data/ML" || domain === "Backend" ? 0.3 : 0) +
      between(-1, 1);
    const originalSourcingScore = Math.round(clamp(40, 98, 55 + sourcingDriver * 7 + between(-10, 10)));

    out.push({
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      currentTitle: `${domain} Engineer`,
      yearsExperience,
      education,
      previousCompanies,
      startupExperience,
      eliteUniversity,
      priorLeadership,
      technicalDomain: domain,
      geography,
      originalSourcingScore,
      interviewStage: "Screen",
      interviewOutcome: "PASSED",
      hired: false,
    });
  }
  return out;
}
