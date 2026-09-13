"use client";
import { RunHistory } from "@/components/layout/RunHistory";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Card, Badge, Button, SectionHeading, EmptyState, Skeleton, ProgressBar } from "@/components/ui/primitives";
import { COUNTRIES, VERTICALS, type Country, type Vertical } from "@/lib/seedData/prospects";
import { pipelineStage } from "@/lib/scoutScoring";
import { PIPELINE_STAGES } from "@/lib/types";

interface Prospect {
  id: string;
  companyName: string;
  country: string;
  vertical: string;
  opportunityScore: number;
  useCase: string | null;
  status: string;
  employeeCountEstimate: string | null;
  whyJson: string;
  outreach: { status: string; channel: string }[];
}
interface Summary {
  latestRun: { startedAt: string; summary: string | null } | null;
  stats: { companiesResearched: number; newQualifiedAccounts: number; decisionMakersIdentified: number; outreachSent: number; replies: number; meetingsBooked: number };
  pipelineCounts: Record<string, number>;
}

const STAGE_LABELS: Record<string, string> = {
  DISCOVERED: "Discovered",
  QUALIFIED: "Qualified",
  OUTREACH_READY: "Outreach ready",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  MEETING_BOOKED: "Meeting booked",
};

// Matches the step labels the agent actually emits (see scoutAgent.ts).
const SCAN_STEP_ORDER = ["Discovering", "Researching", "Scoring"];

function ScanProgress({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SCAN_STEP_ORDER.map((label, i) => {
        const done = steps.includes(label);
        return (
          <div key={label} className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${done ? "bg-scout text-white" : "bg-black/5 text-black/40"}`}>
              {done && "✓"} {label}
            </span>
            {i < SCAN_STEP_ORDER.length - 1 && <span className="text-black/20">→</span>}
          </div>
        );
      })}
    </div>
  );
}

function TodayStats({ summary }: { summary: Summary }) {
  const s = summary.stats;
  const tiles = [
    { label: "Companies researched", value: s.companiesResearched, scope: "since last run" },
    { label: "New qualified accounts", value: s.newQualifiedAccounts, scope: "since last run" },
    { label: "Decision makers identified", value: s.decisionMakersIdentified, scope: "since last run" },
    { label: "Outreach sent", value: s.outreachSent, scope: "all time" },
    { label: "Replies", value: s.replies, scope: "all time" },
    { label: "Meetings booked", value: s.meetingsBooked, scope: "all time" },
  ];
  return (
    <Card className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading eyebrow="Growth Agent" title="Today" detail={summary.latestRun ? `Last run: ${new Date(summary.latestRun.startedAt).toLocaleString()}` : "No runs yet"} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label}>
            <p className="text-2xl font-semibold text-black/85">{t.value}</p>
            <p className="text-xs text-black/50">{t.label}</p>
            <p className="text-[10px] uppercase tracking-wide text-black/30">{t.scope}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Pipeline({ prospects }: { prospects: Prospect[] }) {
  const byStage: Record<string, Prospect[]> = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, []]));
  for (const p of prospects) byStage[pipelineStage(p)].push(p);

  return (
    <Card className="mb-8" padded={false}>
      <div className="p-5 pb-0">
        <SectionHeading eyebrow="Pipeline" title="Where every account stands" />
      </div>
      <div className="grid grid-cols-1 gap-3 overflow-x-auto p-5 pt-3 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="min-w-[160px] rounded-lg bg-black/[0.02] p-2">
            <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-black/45">
              {STAGE_LABELS[stage]} <span className="rounded-full bg-black/10 px-1.5 text-black/60">{byStage[stage].length}</span>
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {byStage[stage].slice(0, 12).map((p) => (
                <Link key={p.id} href={`/scout/${p.id}`} className="block rounded-md border border-black/5 bg-white p-2 text-xs hover:shadow-sm">
                  <p className="truncate font-medium text-black/80">{p.companyName}</p>
                  <p className="truncate text-black/40">{p.country} · {Math.round(p.opportunityScore)}/100</p>
                </Link>
              ))}
              {byStage[stage].length === 0 && <p className="px-1 py-2 text-[11px] text-black/30">Empty</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AddRealTarget({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ companyName: "", country: "Germany", vertical: "Telecommunications", personName: "", personTitle: "", linkedinUrl: "", email: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/scout/targets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      setMsg(res.ok ? `Added ${data.prospect.companyName}${data.decisionMaker ? ` and ${data.decisionMaker.name}` : ""}.` : data.error);
      if (res.ok) {
        onAdded();
        setForm({ companyName: "", country: form.country, vertical: form.vertical, personName: "", personTitle: "", linkedinUrl: "", email: "" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mb-8 rounded-xl2 border border-black/5 bg-white shadow-card">
      <summary className="cursor-pointer select-none p-5 text-sm font-medium text-black/70">Add a real target (a company or person you already know)</summary>
      <div className="space-y-3 border-t border-black/5 p-5">
        <p className="text-xs text-black/50">
          For the one real end-to-end test: enter a real company and, if you have one, a real named contact. This does not invent research — you or a connected
          research pass adds the specific evidence before anything is sent.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className="rounded-md border border-black/10 px-2 py-1.5 text-sm" placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          <select className="rounded-md border border-black/10 px-2 py-1.5 text-sm" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            {[...COUNTRIES, "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded-md border border-black/10 px-2 py-1.5 text-sm" value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })}>
            {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <input className="rounded-md border border-black/10 px-2 py-1.5 text-sm" placeholder="Contact name (optional)" value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} />
          <input className="rounded-md border border-black/10 px-2 py-1.5 text-sm" placeholder="Contact title (optional)" value={form.personTitle} onChange={(e) => setForm({ ...form, personTitle: e.target.value })} />
          <input className="rounded-md border border-black/10 px-2 py-1.5 text-sm" placeholder="LinkedIn URL (optional)" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
          <input className="rounded-md border border-black/10 px-2 py-1.5 text-sm" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <Button size="sm" accent="scout" onClick={submit} disabled={saving || !form.companyName}>{saving ? "Adding…" : "Add real target"}</Button>
        {msg && <p className="text-xs text-black/50">{msg}</p>}
      </div>
    </details>
  );
}

export default function ScoutPage() {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [countries, setCountries] = useState<Country[]>([...COUNTRIES]);
  const [verticals, setVerticals] = useState<Vertical[]>([...VERTICALS]);
  const [scanning, setScanning] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadProspects = () => fetch(`/api/scout/prospects`).then((r) => r.json()).then((d) => setProspects(d.prospects));
  const loadSummary = () => fetch(`/api/scout/summary`).then((r) => r.json()).then(setSummary);

  useEffect(() => {
    loadProspects();
    loadSummary();
  }, []);

  const toggle = <T,>(arr: T[], setArr: (v: T[]) => void, val: T) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const runScan = async () => {
    setScanning(true);
    try {
      setVisibleSteps([]);
      setScanResult(null);
      const res = await fetch("/api/scout/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ countries, verticals, limit: 8 }) });
      const data = await res.json();
      if (!res.ok) {
        setScanResult(data.error ?? "Scan failed");
        return;
      }
      const run = await fetch(`/api/agents/runs/${data.result.runId}`).then((r) => r.json());
      const steps: { label: string }[] = JSON.parse(run.run.stepsJson);
      setVisibleSteps([...new Set(steps.map((s) => s.label))]);
      setScanResult(`Found ${data.result.entitiesFound} companies, added ${data.result.entitiesAccepted} new prospects, refreshed ${data.result.refreshed ?? 0}.`);
      loadProspects();
      loadSummary();
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <ProductHeader
        name="Growth Agent"
        tagline="An autonomous outbound business-development agent for Wonderful. It continuously finds real companies, matches them to a Wonderful use case, identifies decision makers, and prepares personalized outreach — you review and approve what goes out."
        accentText="text-scout"
        accentBg="bg-scout-soft"
      />

      {!summary || !prospects ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <TodayStats summary={summary} />
          <Pipeline prospects={prospects} />
          <AddRealTarget onAdded={() => { loadProspects(); loadSummary(); }} />

          <details className="mb-8 rounded-xl2 border border-black/5 bg-white shadow-card">
            <summary className="cursor-pointer select-none p-5 text-sm font-medium text-black/70">Run a new market scan (the agent also runs on its own schedule)</summary>
            <div className="border-t border-black/5 p-5">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-black/40">Countries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNTRIES.map((c) => (
                      <button key={c} onClick={() => toggle(countries, setCountries, c)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${countries.includes(c) ? "border-scout bg-scout-soft text-scout" : "border-black/10 text-black/50"}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-black/40">Sectors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VERTICALS.map((v) => (
                      <button key={v} onClick={() => toggle(verticals, setVerticals, v)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${verticals.includes(v) ? "border-scout bg-scout-soft text-scout" : "border-black/10 text-black/50"}`}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <Button accent="scout" onClick={runScan} disabled={scanning || countries.length === 0 || verticals.length === 0}>{scanning ? "Scanning…" : "Run a new market scan"}</Button>
              {(scanning || visibleSteps.length > 0) && <div className="mt-4"><ScanProgress steps={visibleSteps} /></div>}
              {scanResult && <p className="mt-3 text-sm text-black/60">{scanResult}</p>}
            </div>
          </details>

          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0">
              <SectionHeading eyebrow="All accounts" title="Ranked target companies" />
            </div>
            <div className="px-5 pb-5">
              {prospects.length === 0 ? (
                <EmptyState title="No prospects yet" detail="Run a market scan or add a real target above." />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {prospects.map((p) => {
                    const why: string[] = JSON.parse(p.whyJson);
                    const awaitingOutreach = p.outreach.some((o) => o.status === "AWAITING_APPROVAL");
                    return (
                      <Link key={p.id} href={`/scout/${p.id}`} className="flex flex-col gap-2 rounded-xl2 border border-black/5 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-black/85">{p.companyName}</p>
                            <p className="text-xs text-black/45">{p.country} · {p.vertical}</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-semibold text-scout">{Math.round(p.opportunityScore)}</span>
                            <span className="text-[10px] text-black/35">/100</span>
                          </div>
                        </div>
                        <ProgressBar value={p.opportunityScore} max={100} colorClass="bg-scout" />
                        <p className="line-clamp-1 text-xs text-black/50">{why[0]}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone="scout">{STAGE_LABELS[pipelineStage(p)]}</Badge>
                          {p.useCase && <Badge tone="neutral">{p.useCase.split(" / ")[0]}</Badge>}
                          {awaitingOutreach && <Badge tone="warning">Outreach awaiting approval</Badge>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
      <RunHistory agent="COMPANY_SCOUT" />
    </main>
  );
}
