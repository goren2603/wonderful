import { db } from "@/lib/db";
import { RADAR_THEMES, type SeedMention } from "@/lib/seedData/radar";
import { rngFor } from "@/lib/random";
import type { AgentStep } from "@/lib/types";

function startOfWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday-start week
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function dateWeeksAgo(weeksAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
  return d;
}

async function recomputeTrendAndAlert(themeId: string) {
  const theme = await db.theme.findUniqueOrThrow({ where: { id: themeId }, include: { mentions: true } });
  await db.trendPoint.deleteMany({ where: { themeId } });

  const buckets = new Map<string, number>();
  for (const m of theme.mentions) {
    const wk = startOfWeek(m.sourceDate).toISOString();
    buckets.set(wk, (buckets.get(wk) ?? 0) + 1);
  }
  const sortedWeeks = [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [weekStart, count] of sortedWeeks) {
    await db.trendPoint.create({ data: { themeId, weekStart: new Date(weekStart), mentionCount: count } });
  }

  const counts = sortedWeeks.map(([, c]) => c);
  const recent = counts.slice(-3);
  const earlier = counts.slice(0, -3);
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const earlierAvg = earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : 0.5;
  const growth = recentAvg / (earlierAvg || 0.5);

  return { evidenceCount: theme.mentions.length, growth, latestWeekCount: counts[counts.length - 1] ?? 0 };
}

export async function seedRadarData(companyName = "Wonderful") {
  const company = await db.company.upsert({
    where: { name: companyName },
    update: {},
    create: { name: companyName, isDefault: true },
  });

  for (const t of RADAR_THEMES) {
    const firstSeenAt = dateWeeksAgo(Math.max(...t.mentions.map((m) => m.weeksAgo)));
    const lastSeenAt = dateWeeksAgo(Math.min(...t.mentions.map((m) => m.weeksAgo)));
    const theme = await db.theme.create({
      data: { companyId: company.id, label: t.label, category: t.category, firstSeenAt, lastSeenAt },
    });

    for (const m of t.mentions) {
      await db.mention.create({
        data: {
          companyId: company.id,
          themeId: theme.id,
          text: m.text,
          sourceName: m.sourceName,
          sourceUrl: m.sourceUrl,
          sourceDate: dateWeeksAgo(m.weeksAgo),
          audienceLens: m.audienceLens,
          sentiment: m.sentiment,
          category: m.category,
          isDemo: true,
        },
      });
    }

    const { evidenceCount, growth } = await recomputeTrendAndAlert(theme.id);

    if (t.alert) {
      await db.alert.create({
        data: {
          companyId: company.id,
          themeId: theme.id,
          title: t.alert.title,
          type: t.alert.type,
          severity: t.alert.severity,
          confidence: t.alert.confidence,
          evidenceCount,
          baseline: t.alert.baseline,
          trend: t.alert.trend,
          aiExplanation: `${t.alert.aiExplanation} (Observed growth ratio: ${growth.toFixed(1)}x over the tracked window.)`,
          recommendedAction: t.alert.recommendedAction,
          status: "OPEN",
        },
      });
    }
  }

  return company.id;
}

const EXTRA_MENTIONS_POOL: Record<string, SeedMention[]> = {
  "work-life-balance": [
    {
      text: "Another late night — hoping this eases up after the release.",
      sourceName: "Glassdoor (sample)",
      sourceUrl: "https://www.glassdoor.com",
      weeksAgo: 0,
      audienceLens: "CANDIDATE",
      sentiment: "NEGATIVE",
      category: "Employer brand",
    },
  ],
  "ai-sourcing-accuracy": [
    {
      text: "Still impressed months in — the match quality hasn't dropped off.",
      sourceName: "Trustpilot (sample)",
      sourceUrl: "https://www.trustpilot.com",
      weeksAgo: 0,
      audienceLens: "CUSTOMER",
      sentiment: "POSITIVE",
      category: "Product feedback",
    },
  ],
};

/**
 * Simulates an ongoing monitoring pass: checks existing sources, and — like a
 * real monitor would every so often — occasionally finds one new mention on
 * an active theme, then re-derives that theme's trend and alert from the
 * updated evidence. Deterministic-with-drift: seeded by the calendar day so
 * repeated runs on the same day don't duplicate a "new" mention.
 */
export async function runRadarScan(companyName = "Wonderful") {
  const startedAt = new Date();
  const steps: AgentStep[] = [];
  const pushStep = (label: string, detail: string) => steps.push({ label, detail, at: new Date().toISOString() });

  const run = await db.agentRun.create({
    data: { agent: "EXTERNAL_RADAR", goal: `Monitor public signals for ${companyName}`, status: "RUNNING" },
  });

  try {
    const company = await db.company.findUnique({ where: { name: companyName }, include: { themes: true } });
    if (!company) throw new Error(`Company ${companyName} not seeded`);

    pushStep("Checking sources", "Polling tracked source types: review sites, forums, press, professional network.");
    const distinctSources = await db.mention.findMany({
      where: { companyId: company.id },
      distinct: ["sourceName"],
      select: { sourceName: true },
    });
    const sourcesChecked = distinctSources.length * 8; // simulate checking N pages per source type

    let entitiesFound = 0;
    let actionsCreated = 0;
    const daySeed = new Date().toISOString().slice(0, 10);

    for (const theme of company.themes) {
      const pool = EXTRA_MENTIONS_POOL[themeKeyFor(theme.label)];
      if (!pool) continue;
      const rng = rngFor(`${theme.id}:${daySeed}`);
      if (rng() < 0.5) {
        const existingToday = await db.mention.findFirst({
          where: { themeId: theme.id, text: pool[0].text },
        });
        if (!existingToday) {
          const m = pool[0];
          await db.mention.create({
            data: {
              companyId: company.id,
              themeId: theme.id,
              text: m.text,
              sourceName: m.sourceName,
              sourceUrl: m.sourceUrl,
              sourceDate: new Date(),
              audienceLens: m.audienceLens,
              sentiment: m.sentiment,
              category: m.category,
              isDemo: true,
            },
          });
          entitiesFound++;
          actionsCreated++;
          pushStep("New mention found", `New sample mention added to theme "${theme.label}".`);

          const { evidenceCount, growth, latestWeekCount } = await recomputeTrendAndAlert(theme.id);
          const alert = await db.alert.findFirst({ where: { themeId: theme.id } });
          if (alert) {
            await db.alert.update({
              where: { id: alert.id },
              data: {
                evidenceCount,
                trend: `Latest week: ${latestWeekCount} mentions (${growth.toFixed(1)}x recent vs. earlier average)`,
                aiExplanation: alert.aiExplanation,
              },
            });
            actionsCreated++;
          }
        }
      }
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
        entitiesAccepted: entitiesFound,
        actionsCreated,
        stepsJson: JSON.stringify(steps),
        summary:
          entitiesFound > 0
            ? `Checked ${sourcesChecked} sources, found ${entitiesFound} new mention(s), updated ${actionsCreated - entitiesFound} alert(s).`
            : `Checked ${sourcesChecked} sources, no new signal since last run.`,
      },
    });

    return { runId: run.id, entitiesFound };
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

function themeKeyFor(label: string): string {
  const found = RADAR_THEMES.find((t) => t.label === label);
  return found?.key ?? label;
}
