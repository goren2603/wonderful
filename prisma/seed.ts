import { db } from "../src/lib/db";
import { generateSeedCandidates, generateNewBatch } from "../src/lib/seedData/candidates";
import { runTalentAnalysis } from "../src/lib/agents/talentAgent";
import { runCompanyScoutScan } from "../src/lib/agents/scoutAgent";
import { seedRadarData, runRadarScan } from "../src/lib/agents/radarAgent";
import { COUNTRIES, VERTICALS } from "../src/lib/seedData/prospects";
import { DEFAULT_JOBS } from "../src/lib/scheduler";
import { Cron } from "croner";

async function clearAll() {
  await db.$transaction([
    db.mention.deleteMany({}),
    db.trendPoint.deleteMany({}),
    db.alert.deleteMany({}),
    db.theme.deleteMany({}),
    db.company.deleteMany({}),
    db.evidence.deleteMany({}),
    db.outreachMessage.deleteMany({}),
    db.decisionMaker.deleteMany({}),
    db.scoreHistory.deleteMany({}),
    db.prospect.deleteMany({}),
    db.learnedRanking.deleteMany({}),
    db.sourcingModelEvaluation.deleteMany({}),
    db.sourcingWeightProposal.deleteMany({}),
    db.sourcingInsight.deleteMany({}),
    db.performanceRecord.deleteMany({}),
    db.hireOutcome.deleteMany({}),
    db.interviewOutcome.deleteMany({}),
    db.candidate.deleteMany({}),
    db.approvalItem.deleteMany({}),
    db.feedback.deleteMany({}),
    db.auditLogEntry.deleteMany({}),
    db.agentRun.deleteMany({}),
    db.scheduledJob.deleteMany({}),
  ]);
}

async function seedTalent() {
  const candidates = generateSeedCandidates(400);
  const now = Date.now();
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const createdAt = new Date(now - (candidates.length - i) * 86400000 * 1.8); // spread over ~2 years
    const candidate = await db.candidate.create({
      data: {
        name: c.name,
        currentTitle: c.currentTitle,
        yearsExperience: c.yearsExperience,
        education: c.education,
        previousCompaniesJson: JSON.stringify(c.previousCompanies),
        startupExperience: c.startupExperience,
        eliteUniversity: c.eliteUniversity,
        priorLeadership: c.priorLeadership,
        technicalDomain: c.technicalDomain,
        geography: c.geography,
        originalSourcingScore: c.originalSourcingScore,
        createdAt,
      },
    });

    await db.interviewOutcome.create({
      data: {
        candidateId: candidate.id,
        stage: c.interviewStage,
        outcome: c.interviewOutcome,
        interviewedAt: new Date(createdAt.getTime() + 14 * 86400000),
      },
    });

    if (c.interviewStage === "Final" || c.hired) {
      await db.hireOutcome.create({
        data: {
          candidateId: candidate.id,
          hired: c.hired,
          hireDate: c.hired ? new Date(createdAt.getTime() + 30 * 86400000) : null,
          rejectionReason: c.rejectionReason ?? null,
        },
      });
    }

    if (c.hired && c.retentionMonths != null) {
      await db.performanceRecord.create({
        data: {
          candidateId: candidate.id,
          retentionMonths: c.retentionMonths,
          managerRating: c.managerRating,
          promotionVelocityMonths: c.promotionVelocityMonths,
          stillEmployed: c.stillEmployed ?? true,
          department: c.department ?? null,
          roleHiredInto: c.roleHiredInto ?? null,
          currentRole: c.currentRole ?? null,
          promotions: c.promotions ?? 0,
          highPerformer: c.highPerformer ?? false,
          customMetricsJson: JSON.stringify({}),
        },
      });
    }
  }
  console.log(`Seeded ${candidates.length} historical candidates.`);

  const batch = generateNewBatch(24);
  for (const c of batch) {
    await db.candidate.create({
      data: {
        name: c.name,
        currentTitle: c.currentTitle,
        yearsExperience: c.yearsExperience,
        education: c.education,
        previousCompaniesJson: JSON.stringify(c.previousCompanies),
        startupExperience: c.startupExperience,
        eliteUniversity: c.eliteUniversity,
        priorLeadership: c.priorLeadership,
        technicalDomain: c.technicalDomain,
        geography: c.geography,
        originalSourcingScore: c.originalSourcingScore,
        isNewBatch: true,
      },
    });
  }
  console.log(`Seeded ${batch.length} new-batch candidates (not yet decided).`);

  await runTalentAnalysis();
  console.log("Ran initial sourcing model audit.");
}

async function seedScout() {
  await runCompanyScoutScan({ countries: COUNTRIES, verticals: VERTICALS, limit: 32 });
  console.log("Ran initial Growth Agent scan.");
}

async function seedRadar() {
  await seedRadarData("Wonderful");
  await runRadarScan("Wonderful");
  console.log("Seeded External Radar data.");
  // The one real, live-data company (see radarAgent.ts) — seeded up front so
  // it's visible without waiting for the next scheduled tick.
  await runRadarScan();
  console.log("Ran initial live-source Radar scan.");
}

async function seedJobs() {
  for (const def of DEFAULT_JOBS) {
    const cron = new Cron(def.cronExpr, { paused: true });
    await db.scheduledJob.upsert({
      where: { agentKey: def.agentKey },
      update: {},
      create: {
        agentKey: def.agentKey,
        label: def.label,
        cronExpr: def.cronExpr,
        enabled: true,
        lastRunAt: new Date(),
        lastStatus: "SUCCEEDED",
        nextRunAt: cron.nextRun() ?? undefined,
      },
    });
    cron.stop();
  }
  console.log("Seeded scheduled jobs.");
}

async function main() {
  console.log("Clearing existing data...");
  await clearAll();
  await seedTalent();
  await seedScout();
  await seedRadar();
  await seedJobs();
  // Agents create their own approval items on every run.
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
