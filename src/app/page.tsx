"use client";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, LiveDot, Skeleton } from "@/components/ui/primitives";

interface AgentStatus {
  agent: "TALENT_INTELLIGENCE" | "COMPANY_SCOUT" | "EXTERNAL_RADAR";
  job: { cronExpr: string; enabled: boolean; lastRunAt: string | null; nextRunAt: string | null; lastStatus: string | null } | null;
  latestRun: { summary: string | null; status: string; startedAt: string; entitiesAccepted: number; actionsCreated: number } | null;
}

const PRODUCTS = [
  {
    key: "TALENT_INTELLIGENCE" as const,
    href: "/talent",
    name: "Sourcing Optimizer",
    tagline: "Audits Wonderful's sourcing model against real employee outcomes and validates a better one before recommending it.",
    accent: "#6d5efc",
    bg: "bg-talent-soft",
    text: "text-talent",
    loop: "MODEL V1 → OUTCOMES → AUDIT → MODEL V2 → VALIDATION → MONITORING",
  },
  {
    key: "COMPANY_SCOUT" as const,
    href: "/scout",
    name: "Growth Agent",
    tagline: "An autonomous outbound BD agent: finds real companies and people, researches them, and prepares personalized outreach for your approval.",
    accent: "#0f9d76",
    bg: "bg-scout-soft",
    text: "text-scout",
    loop: "FIND COMPANY → FIND PERSON → RESEARCH → CONTACT → TRACK → LEARN",
  },
  {
    key: "EXTERNAL_RADAR" as const,
    href: "/radar",
    name: "External Radar",
    tagline: "Reanalyzes monitored evidence on a schedule and turns scattered mentions into explained, confidence-scored alerts.",
    accent: "#e8622c",
    bg: "bg-radar-soft",
    text: "text-radar",
    loop: "MENTION → THEME → TREND → ALERT / OPPORTUNITY",
  },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function futureTime(iso: string | null): string {
  if (!iso) return "unscheduled";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs < 0) return "due now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export default function LauncherPage() {
  const [statuses, setStatuses] = useState<AgentStatus[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/agents/status")
        .then((r) => r.json())
        .then((d) => active && setStatuses(d.agents));
    load();
    const interval = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const statusFor = (key: string) => statuses?.find((s) => s.agent === key);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-14">
      <header className="mb-12">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-black/40">Wonderful</p>
        <h1 className="text-4xl font-semibold tracking-tight text-black/90">Wonderful Intelligence</h1>
        <p className="mt-3 max-w-2xl text-base text-black/55">
          Three autonomous intelligence products, one shared digital workforce. Scheduled analysis, evidence-linked decisions, and approval-gated drafts. Start with a product below.
        </p>
      </header>

      <section className="mb-16 grid grid-cols-1 gap-5 md:grid-cols-3">
        {PRODUCTS.map((p) => {
          const status = statusFor(p.key);
          const isWorking = status?.latestRun?.status === "RUNNING";
          return (
            <Link key={p.key} href={p.href} className="group block">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-lg" padded={false}>
                <div className={`rounded-t-xl2 ${p.bg} px-5 py-4`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${p.text}`}>{p.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-black/50">
                      <LiveDot active={Boolean(status?.job?.enabled)} />
                      {isWorking ? "Working" : status?.job?.enabled ? "Scheduled" : "Idle"}
                    </span>
                  </div>
                </div>
                <div className="flex h-full flex-col gap-4 p-5">
                  <p className="text-sm leading-relaxed text-black/60">{p.tagline}</p>
                  <p className="rounded-md bg-black/[0.03] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-black/40">
                    {p.loop}
                  </p>
                  <div className="mt-auto space-y-1.5 border-t border-black/5 pt-3 text-xs text-black/50">
                    {!statuses ? (
                      <>
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </>
                    ) : (
                      <>
                        <p>
                          Last run: <span className="text-black/70">{relativeTime(status?.latestRun?.startedAt ?? null)}</span>
                        </p>
                        <p className="line-clamp-1">{status?.latestRun?.summary ?? "No runs yet — will run on schedule."}</p>
                        <p>
                          Next run: <span className="text-black/70">{futureTime(status?.job?.nextRunAt ?? null)}</span>
                        </p>
                      </>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${p.text}`}>
                    Open {p.name} →
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-black/90">Digital Workforce</h2>
            <p className="text-sm text-black/50">What your autonomous team has been doing, at a glance.</p>
          </div>
        </div>
        <Card className="divide-y divide-black/5" padded={false}>
          {PRODUCTS.map((p) => {
            const status = statusFor(p.key);
            const run = status?.latestRun;
            const isWorking = run?.status === "RUNNING";
            return (
              <div key={p.key} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.accent }} />
                  <div>
                    <p className="text-sm font-medium text-black/85">{p.name}</p>
                    <p className="text-xs text-black/45">
                      {isWorking ? "Working now" : status?.job?.enabled ? "Scheduled analysis" : "Scheduled"}
                    </p>
                  </div>
                </div>
                <div className="hidden flex-1 text-sm text-black/55 sm:block">
                  {run ? run.summary : "No activity yet."}
                </div>
                <div className="flex items-center gap-3 text-xs text-black/45">
                  {run && <Badge tone={run.status === "SUCCEEDED" ? "positive" : run.status === "FAILED" ? "negative" : "neutral"}>{run.status.toLowerCase()}</Badge>}
                  <span>{relativeTime(run?.startedAt ?? null)}</span>
                </div>
              </div>
            );
          })}
        </Card>
      </section>
    </main>
  );
}
