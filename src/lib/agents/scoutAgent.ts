import { db } from "@/lib/db";
import { rngFor } from "@/lib/random";
import {
  SEED_COMPANIES,
  SIGNAL_LIBRARY,
  USE_CASE_BY_VERTICAL,
  DECISION_MAKER_TITLES_BY_VERTICAL,
  type Country,
  type Vertical,
} from "@/lib/seedData/prospects";
import type { ScoreComponent, AgentStep } from "@/lib/types";

export interface ScoutScanParams {
  countries: Country[];
  verticals: Vertical[];
  limit?: number;
}

function parseEmployeeScale(estimate: string): number {
  const n = parseInt(estimate.replace(/[^0-9]/g, ""), 10) || 1000;
  if (n >= 100000) return 20;
  if (n >= 50000) return 18;
  if (n >= 15000) return 15;
  if (n >= 5000) return 12;
  return 8;
}

function scoreCompany(company: (typeof SEED_COMPANIES)[number]): {
  score: number;
  breakdown: ScoreComponent[];
} {
  const rng = rngFor(`${company.name}:${company.country}`);
  const signals = SIGNAL_LIBRARY[company.vertical];

  const operationalPain = Math.round(14 + rng() * 11); // /25
  const scale = parseEmployeeScale(company.employeeCountEstimate); // /20
  const aiReadiness = Math.round(8 + rng() * 12); // /20
  const multilingual = Math.round(8 + rng() * 7); // /15
  const urgency = Math.round(6 + rng() * 9); // /15
  const execAccess = Math.round(2 + rng() * 3); // /5

  const breakdown: ScoreComponent[] = [
    {
      label: "Operational pain",
      score: operationalPain,
      max: 25,
      why: signals[0],
      evidenceIds: [],
    },
    {
      label: "Company scale",
      score: scale,
      max: 20,
      why: `Estimated headcount ${company.employeeCountEstimate} — larger organizations carry more operational surface area for AI-assisted workflows.`,
      evidenceIds: [],
    },
    {
      label: "AI readiness",
      score: aiReadiness,
      max: 20,
      why: signals[1],
      evidenceIds: [],
    },
    {
      label: "Multilingual complexity",
      score: multilingual,
      max: 15,
      why: signals[2],
      evidenceIds: [],
    },
    {
      label: "Urgency / growth",
      score: urgency,
      max: 15,
      why: signals[3],
      evidenceIds: [],
    },
    {
      label: "Executive accessibility",
      score: execAccess,
      max: 5,
      why: "Estimated based on public leadership visibility and org structure signals.",
      evidenceIds: [],
    },
  ];

  const score = breakdown.reduce((a, b) => a + b.score, 0);
  return { score, breakdown };
}

export async function runCompanyScoutScan(params: ScoutScanParams) {
  const startedAt = new Date();
  const steps: AgentStep[] = [];
  const pushStep = (label: string, detail: string) =>
    steps.push({ label, detail, at: new Date().toISOString() });

  const run = await db.agentRun.create({
    data: {
      agent: "COMPANY_SCOUT",
      goal: `Scan ${params.countries.join(", ")} across ${params.verticals.join(", ")}`,
      status: "RUNNING",
      stepsJson: "[]",
    },
  });

  let sourcesChecked = 0;
  let entitiesFound = 0;
  let entitiesAccepted = 0;
  let actionsCreated = 0;
  const warnings: string[] = [];

  try {
    pushStep("Discovering", `Scanning target company universe for ${params.countries.join(", ")}.`);
    const candidates = SEED_COMPANIES.filter(
      (c) => params.countries.includes(c.country) && params.verticals.includes(c.vertical)
    ).slice(0, params.limit ?? 12);
    entitiesFound = candidates.length;

    pushStep("Researching", `Gathering public signals for ${candidates.length} candidate companies.`);

    for (const company of candidates) {
      sourcesChecked += 3;
      const dedupeKey = `${company.name}::${company.country}`;
      const existing = await db.prospect.findUnique({ where: { dedupeKey } });
      if (existing) {
        warnings.push(`Skipped duplicate: ${company.name} (${company.country}) already tracked.`);
        continue;
      }

      const { score, breakdown } = scoreCompany(company);
      const useCase = USE_CASE_BY_VERTICAL[company.vertical];
      const titles = DECISION_MAKER_TITLES_BY_VERTICAL[company.vertical];
      const signals = SIGNAL_LIBRARY[company.vertical];

      const why = [
        `${company.employeeCountEstimate} estimated employees across ${company.country} and adjacent markets.`,
        signals[0],
        signals[1],
        `Opportunity score ${score}/100 driven primarily by ${breakdown
          .slice()
          .sort((a, b) => b.score / b.max - a.score / a.max)[0].label.toLowerCase()}.`,
      ];

      const prospect = await db.prospect.create({
        data: {
          companyName: company.name,
          dedupeKey,
          country: company.country,
          vertical: company.vertical,
          website: company.website,
          employeeCountEstimate: company.employeeCountEstimate,
          opportunityScore: score,
          scoreBreakdownJson: JSON.stringify(breakdown),
          useCase: useCase.useCase,
          useCaseRationale: useCase.rationale,
          status: "SCORED",
          whyJson: JSON.stringify(why),
          runId: run.id,
        },
      });
      entitiesAccepted++;
      actionsCreated++;

      await db.scoreHistory.create({
        data: { prospectId: prospect.id, score, breakdownJson: JSON.stringify(breakdown) },
      });

      // Evidence — always a real root domain, always labeled demo.
      const evidenceTexts = [signals[0], signals[1], signals[2]];
      for (const text of evidenceTexts) {
        await db.evidence.create({
          data: {
            entityType: "PROSPECT",
            entityId: prospect.id,
            sourceUrl: company.website,
            sourceName: `${company.name} — public signal (sample)`,
            sourceDate: new Date(),
            title: `Public signal: ${company.name}`,
            snippet: text,
            confidence: Math.round((0.6 + rngFor(text)() * 0.3) * 100) / 100,
            provider: "demo",
            isDemo: true,
          },
        });
      }

      pushStep("Scoring", `${company.name}: opportunity score ${score}/100.`);

      // Decision-maker roles — role-based, not a fabricated named individual.
      pushStep("Finding decision makers", `Identifying likely buying roles at ${company.name}.`);
      for (const title of titles.slice(0, 2)) {
        await db.decisionMaker.create({
          data: {
            prospectId: prospect.id,
            name: "Pending live research",
            title,
            linkedinUrl: null,
            confidence: Math.round((0.5 + rngFor(title + company.name)() * 0.3) * 100) / 100,
          },
        });
      }

      // Outreach draft
      pushStep("Preparing outreach", `Drafting personalized outreach angle for ${company.name}.`);
      const angle = `${company.name}'s scale in ${company.country} plus ${useCase.useCase.toLowerCase()} pain points make this a strong fit for Wonderful's AI operations layer.`;
      const body = `Hi {{decision_maker_first_name}},\n\nI've been following ${company.name}'s operations in ${company.country} — ${signals[0].toLowerCase()} ${signals[1].toLowerCase()}\n\nWonderful helps enterprises like yours apply AI to ${useCase.useCase.toLowerCase()}, without ripping out existing systems. Given ${company.name}'s scale (${company.employeeCountEstimate} employees), I think there's a strong fit.\n\nOpen to a short conversation?\n\nBest,\n{{sender_name}}`;
      await db.outreachMessage.create({
        data: {
          prospectId: prospect.id,
          channel: "EMAIL",
          subject: `AI for ${company.name}'s ${useCase.useCase.split(" / ")[0].toLowerCase()} operations`,
          body,
          angle,
          status: "AWAITING_APPROVAL",
        },
      });
      actionsCreated++;
      await db.outreachMessage.create({
        data: {
          prospectId: prospect.id,
          channel: "LINKEDIN",
          subject: null,
          body: `Hi — I work with enterprises on AI-assisted operations and noticed ${company.name}'s scale in ${company.country}. ${signals[0]} Worth a quick chat about ${useCase.useCase.toLowerCase()}?`,
          angle,
          status: "DRAFT",
        },
      });
      actionsCreated++;
    }

    const durationMs = Date.now() - startedAt.getTime();
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        endedAt: new Date(),
        durationMs,
        sourcesChecked,
        entitiesFound,
        entitiesAccepted,
        actionsCreated,
        warningsJson: JSON.stringify(warnings),
        stepsJson: JSON.stringify(steps),
        summary: `Found ${entitiesFound} companies, accepted ${entitiesAccepted} new prospects, prepared ${actionsCreated} actions.`,
      },
    });

    return { runId: run.id, entitiesAccepted, entitiesFound, actionsCreated };
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
