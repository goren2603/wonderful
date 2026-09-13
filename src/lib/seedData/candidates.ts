// Synthetic (clearly demo) candidate history for Talent Intelligence.
// Generated with deliberate, documented correlations so the statistics
// engine has real signal to find — not random noise, and not hand-picked
// per-insight, so the analysis step still has to go find it.

export interface SeedCandidate {
  name: string;
  currentTitle: string;
  yearsExperience: number;
  education: string;
  previousCompanies: string[];
  startupExperience: boolean;
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

const rand = mulberry32(20260913);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const chance = (p: number) => rand() < p;

const DOMAINS = ["Backend", "Frontend", "Data/ML", "DevOps/Infra", "Mobile", "Full-stack"];
const GEOS = ["Germany", "United Kingdom", "France", "Netherlands", "Remote-EU"];
const EDUCATION = ["BSc Computer Science", "MSc Computer Science", "Bootcamp", "Self-taught", "PhD", "BSc Engineering"];
const COMPANIES = [
  "Deutsche Telekom", "Spotify", "Klarna", "N26", "Zalando", "Booking.com", "Revolut", "Adyen",
  "SAP", "small startup (seed stage)", "small startup (Series A)", "Siemens", "Delivery Hero",
  "local agency", "freelance", "Amazon", "Google", "Criteo", "Contentful", "GetYourGuide",
];

export function generateSeedCandidates(count = 220): SeedCandidate[] {
  const out: SeedCandidate[] = [];
  for (let i = 0; i < count; i++) {
    const startupExperience = chance(0.4);
    const yearsExperience = Math.round(between(0.5, 16) * 10) / 10;
    const domain = pick(DOMAINS);
    const geography = pick(GEOS);
    const education = pick(EDUCATION);
    const numPrev = Math.floor(between(1, 4));
    const previousCompanies = Array.from({ length: numPrev }, () => pick(COMPANIES));

    // Ground-truth signal baked into generation (the agent has to discover
    // this from the data — it isn't told these weights):
    // startup experience and prior interview performance correlate with
    // retention + manager rating; years of experience alone barely does;
    // original sourcing score is only weakly related to actual performance.
    const latentQuality =
      (startupExperience ? 0.9 : 0) +
      Math.min(yearsExperience, 8) * 0.12 +
      (domain === "Data/ML" || domain === "Backend" ? 0.3 : 0) +
      between(-1.4, 1.4); // noise dominates — realistic, not deterministic

    const originalSourcingScore = Math.round(
      Math.max(40, Math.min(98, 60 + latentQuality * 4 + between(-14, 14)))
    );

    const passedScreen = chance(0.72);
    let interviewStage: SeedCandidate["interviewStage"] = "Screen";
    let interviewOutcome: SeedCandidate["interviewOutcome"] = "FAILED";
    let hired = false;
    let rejectionReason: string | undefined;

    if (passedScreen) {
      const passedOnsite = chance(0.55 + (startupExperience ? 0.08 : 0));
      interviewStage = "Onsite";
      if (passedOnsite) {
        const passedFinal = chance(0.6 + latentQuality * 0.03);
        interviewStage = "Final";
        if (passedFinal) {
          interviewOutcome = "PASSED";
          hired = chance(0.78);
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

    if (hired) {
      const tenureBase = 8 + latentQuality * 2.2 + between(-6, 10);
      retentionMonths = Math.round(Math.max(1, Math.min(48, tenureBase)) * 10) / 10;
      managerRating = Math.round(Math.max(1, Math.min(5, 2.6 + latentQuality * 0.32 + between(-0.8, 0.8))) * 10) / 10;
      if (chance(0.35 + (startupExperience ? 0.1 : 0)) && retentionMonths > 9) {
        promotionVelocityMonths = Math.round(Math.max(6, 20 - latentQuality * 1.5 + between(-4, 4)));
      }
    }

    out.push({
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      currentTitle: `${domain} Engineer`,
      yearsExperience,
      education,
      previousCompanies,
      startupExperience,
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
    });
  }
  return out;
}
