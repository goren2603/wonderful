// Demo monitoring history for External Intelligence Radar.
//
// "Wonderful" is seeded as the default tracked company. All mention text
// below is illustrative/synthetic (isDemo: true) — written to demonstrate
// the mention → theme → trend → alert pipeline, not scraped real content.
// sourceUrl always points at a real platform's root domain, never a
// fabricated deep link, so nothing here can be mistaken for a real citation.

export type AudienceLens = "CANDIDATE" | "CUSTOMER" | "EXECUTIVE" | "INVESTOR";
export type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface SeedMention {
  text: string;
  sourceName: string;
  sourceUrl: string;
  weeksAgo: number; // 0 = this week
  audienceLens: AudienceLens;
  sentiment: Sentiment;
  category: string;
}

export interface SeedTheme {
  key: string;
  label: string;
  category: string;
  mentions: SeedMention[];
  alert?: {
    title: string;
    type: "RISK" | "OPPORTUNITY";
    severity: "LOW" | "MEDIUM" | "HIGH";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    baseline: string;
    trend: string;
    aiExplanation: string;
    recommendedAction: string;
  };
}

const glassdoor = (t: string, w: number, s: Sentiment): SeedMention => ({
  text: t,
  sourceName: "Glassdoor (sample)",
  sourceUrl: "https://www.glassdoor.com",
  weeksAgo: w,
  audienceLens: "CANDIDATE",
  sentiment: s,
  category: "Employer brand",
});

const reddit = (t: string, w: number, s: Sentiment, lens: AudienceLens = "CANDIDATE"): SeedMention => ({
  text: t,
  sourceName: "Reddit (sample)",
  sourceUrl: "https://www.reddit.com",
  weeksAgo: w,
  audienceLens: lens,
  sentiment: s,
  category: "Public forum",
});

const trustpilot = (t: string, w: number, s: Sentiment): SeedMention => ({
  text: t,
  sourceName: "Trustpilot (sample)",
  sourceUrl: "https://www.trustpilot.com",
  weeksAgo: w,
  audienceLens: "CUSTOMER",
  sentiment: s,
  category: "Product feedback",
});

const linkedin = (t: string, w: number, s: Sentiment, lens: AudienceLens = "EXECUTIVE"): SeedMention => ({
  text: t,
  sourceName: "LinkedIn (sample)",
  sourceUrl: "https://www.linkedin.com",
  weeksAgo: w,
  audienceLens: lens,
  sentiment: s,
  category: "Leadership / company update",
});

const news = (t: string, w: number, s: Sentiment, lens: AudienceLens = "INVESTOR"): SeedMention => ({
  text: t,
  sourceName: "Industry press (sample)",
  sourceUrl: "https://techcrunch.com",
  weeksAgo: w,
  audienceLens: lens,
  sentiment: s,
  category: "Market signal",
});

export const RADAR_THEMES: SeedTheme[] = [
  {
    key: "work-life-balance",
    label: "Work-life balance",
    category: "Employer brand",
    mentions: [
      glassdoor("Hours are brutal during launch weeks.", 6, "NEGATIVE"),
      glassdoor("Work-life balance is difficult right now.", 4, "NEGATIVE"),
      reddit("Heard the crunch culture is real there lately.", 3, "NEGATIVE"),
      glassdoor("Very long weeks, though the work itself is interesting.", 2, "NEGATIVE"),
      glassdoor("Management says balance matters but the calendar disagrees.", 1, "NEGATIVE"),
      reddit("Anyone else hear people are burning out on that team?", 1, "NEGATIVE"),
      glassdoor("Third launch in a row with no recovery time.", 0, "NEGATIVE"),
      reddit("Friend there is job hunting because of the hours.", 0, "NEGATIVE"),
      glassdoor("Great mission, exhausting pace.", 0, "NEGATIVE"),
      reddit("Culture seems to be shifting, and not in a good way.", 0, "NEGATIVE"),
      reddit("Recruiter reached out — anyone know if the hours rumors are true?", 0, "NEUTRAL"),
    ],
    alert: {
      title: "Emerging employer-brand risk: work-life balance",
      type: "RISK",
      severity: "MEDIUM",
      confidence: "HIGH",
      baseline: "~1 mention/week over the prior 6 weeks",
      trend: "1 → 2 → 7 mentions in the most recent 3 weeks",
      aiExplanation:
        "Mentions of workload and hours have grown roughly 3.5x over three weeks, concentrated on Glassdoor and Reddit and consistently negative in sentiment. The volume and consistency (not a single viral post) is what pushes this to a real trend rather than noise — worth a proactive response before it affects sourcing conversion.",
      recommendedAction:
        "Have People/Comms address workload directly in the next all-hands or public update; monitor whether mention volume keeps climbing next week.",
    },
  },
  {
    key: "ai-sourcing-accuracy",
    label: "AI sourcing accuracy praise",
    category: "Product feedback",
    mentions: [
      trustpilot("The sourcing suggestions have been shockingly accurate.", 5, "POSITIVE"),
      linkedin("Impressed by how fast their AI sourcing surfaced strong candidates.", 4, "POSITIVE", "CUSTOMER"),
      trustpilot("Cut our sourcing time significantly this quarter.", 2, "POSITIVE"),
      trustpilot("Best candidate match quality we've seen from a sourcing tool.", 1, "POSITIVE"),
      reddit("A recruiter friend won't stop talking about this sourcing tool.", 1, "POSITIVE", "CUSTOMER"),
      trustpilot("Renewed for another year — the accuracy keeps improving.", 0, "POSITIVE"),
    ],
    alert: {
      title: "Positive signal: sourcing accuracy driving customer advocacy",
      type: "OPPORTUNITY",
      severity: "LOW",
      confidence: "MEDIUM",
      baseline: "~1 positive product mention/week",
      trend: "Steady positive mentions, ticking up over the last 2 weeks",
      aiExplanation:
        "Unprompted praise for sourcing accuracy is showing up across review sites and social — a usable proof point for sales and marketing while it's fresh.",
      recommendedAction: "Ask satisfied customers in this cluster for a case study or public quote.",
    },
  },
  {
    key: "leadership-change",
    label: "Leadership change",
    category: "Leadership / company update",
    mentions: [
      linkedin("Excited to join Wonderful as Head of Customer Success.", 1, "POSITIVE"),
      news("Wonderful adds enterprise-focused exec to leadership team.", 1, "NEUTRAL"),
      linkedin("New leadership hire signals a bigger enterprise push.", 0, "POSITIVE"),
    ],
    alert: {
      title: "Leadership addition signals enterprise push",
      type: "OPPORTUNITY",
      severity: "LOW",
      confidence: "MEDIUM",
      baseline: "No prior leadership-change mentions this quarter",
      trend: "New signal, 3 mentions in 2 weeks",
      aiExplanation:
        "A newly announced enterprise-focused leadership hire is a reasonable public signal of increased enterprise investment — useful context for Company Scout's outreach framing, not a standalone causal claim.",
      recommendedAction: "Align Company Scout outreach angles with the enterprise push while it's topical.",
    },
  },
  {
    key: "competitor-layoffs",
    label: "Competitor layoffs",
    category: "Market signal",
    mentions: [
      news("Rival recruiting-AI vendor announces workforce reduction.", 2, "NEGATIVE", "INVESTOR"),
      reddit("Layoffs hitting our sourcing tool vendor — anyone switching?", 1, "NEUTRAL", "CUSTOMER"),
      news("Second round of cuts reported at competing vendor.", 0, "NEGATIVE", "INVESTOR"),
    ],
    alert: {
      title: "Competitor instability may open switching conversations",
      type: "OPPORTUNITY",
      severity: "MEDIUM",
      confidence: "MEDIUM",
      baseline: "No competitor layoff signal prior to this month",
      trend: "3 mentions across 3 weeks, escalating in tone",
      aiExplanation:
        "Public reporting plus customer-forum chatter both point to instability at a competing vendor. This is an observed pattern, not a confirmed causal driver of any specific customer's decision — treat as a prompt to reach out, not a guarantee.",
      recommendedAction: "Brief Company Scout outreach team; prioritize prospects known to use the affected competitor.",
    },
  },
  {
    key: "onboarding-friction",
    label: "Onboarding friction",
    category: "Product feedback",
    mentions: [
      trustpilot("Setup took longer than expected for our team.", 3, "NEGATIVE"),
      reddit("Onboarding docs could be clearer.", 2, "NEGATIVE", "CUSTOMER"),
      trustpilot("A bit of a learning curve to get the first workflow running.", 1, "NEUTRAL"),
    ],
    alert: {
      title: "Minor onboarding friction pattern",
      type: "RISK",
      severity: "LOW",
      confidence: "LOW",
      baseline: "Isolated mentions, no prior pattern",
      trend: "3 mentions in 3 weeks — small sample",
      aiExplanation:
        "Small number of mentions; consistent theme but low volume means this is worth watching, not yet acting on with confidence.",
      recommendedAction: "Flag to product/CS team as a watch item; revisit if volume grows.",
    },
  },
];
