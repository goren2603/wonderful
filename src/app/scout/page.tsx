"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Card, Badge, ConfidenceBadge, Button, SectionHeading, EmptyState, Skeleton, ProgressBar } from "@/components/ui/primitives";
import { COUNTRIES, VERTICALS, type Country, type Vertical } from "@/lib/seedData/prospects";

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

interface RunHistory {
  id: string;
  status: string;
  startedAt: string;
  summary: string | null;
  entitiesAccepted: number;
  actionsCreated: number;
  stepsJson: string;
}

const SCAN_STEP_ORDER = ["Discovering", "Researching", "Scoring", "Finding decision makers", "Preparing outreach"];

function ScanProgress({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SCAN_STEP_ORDER.map((label, i) => {
        const done = steps.includes(label);
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                done ? "bg-scout text-white" : "bg-black/5 text-black/40"
              }`}
            >
              {done && "✓"} {label}
            </span>
            {i < SCAN_STEP_ORDER.length - 1 && <span className="text-black/20">→</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function ScoutPage() {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [history, setHistory] = useState<RunHistory[] | null>(null);
  const [countries, setCountries] = useState<Country[]>([...COUNTRIES]);
  const [verticals, setVerticals] = useState<Vertical[]>([...VERTICALS]);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [scanning, setScanning] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadProspects = () => {
    const params = new URLSearchParams();
    if (filterCountry) params.set("country", filterCountry);
    if (filterVertical) params.set("vertical", filterVertical);
    fetch(`/api/scout/prospects?${params}`)
      .then((r) => r.json())
      .then((d) => setProspects(d.prospects));
  };
  const loadHistory = () => fetch("/api/agents/runs?agent=COMPANY_SCOUT&limit=8").then((r) => r.json()).then((d) => setHistory(d.runs));

  useEffect(() => {
    loadProspects();
  }, [filterCountry, filterVertical]);
  useEffect(() => {
    loadHistory();
  }, []);

  const toggle = <T,>(arr: T[], setArr: (v: T[]) => void, val: T) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const runScan = async () => {
    setScanning(true);
    setVisibleSteps([]);
    setScanResult(null);
    const res = await fetch("/api/scout/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ countries, verticals, limit: 8 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setScanResult(data.error ?? "Scan failed");
      setScanning(false);
      return;
    }
    const run = await fetch(`/api/agents/runs/${data.result.runId}`).then((r) => r.json());
    const steps: { label: string }[] = JSON.parse(run.run.stepsJson);
    const uniqueLabels = [...new Set(steps.map((s) => s.label))];
    for (const label of uniqueLabels) {
      await new Promise((r) => setTimeout(r, 450));
      setVisibleSteps((prev) => [...prev, label]);
    }
    setScanResult(`Found ${data.result.entitiesFound} companies, added ${data.result.entitiesAccepted} new prospects.`);
    loadProspects();
    loadHistory();
    setScanning(false);
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <ProductHeader
        name="Company Scout"
        tagline="An autonomous market-entry and enterprise prospecting agent for Wonderful — discovers, researches, scores, and preps outreach for European enterprise targets."
        accentText="text-scout"
        accentBg="bg-scout-soft"
      />

      <Card className="mb-8">
        <SectionHeading
          eyebrow="Run the agent"
          title="Run a new market scan"
          detail="Pick markets and sectors — the agent discovers companies, researches signals, scores opportunity, finds decision-maker roles, and drafts outreach."
        />
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-black/40">Countries</p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => (
                <button
                  key={c}
                  onClick={() => toggle(countries, setCountries, c)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    countries.includes(c) ? "border-scout bg-scout-soft text-scout" : "border-black/10 text-black/50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-black/40">Sectors</p>
            <div className="flex flex-wrap gap-1.5">
              {VERTICALS.map((v) => (
                <button
                  key={v}
                  onClick={() => toggle(verticals, setVerticals, v)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    verticals.includes(v) ? "border-scout bg-scout-soft text-scout" : "border-black/10 text-black/50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button accent="scout" onClick={runScan} disabled={scanning || countries.length === 0 || verticals.length === 0}>
          {scanning ? "Scanning…" : "Run a new market scan"}
        </Button>
        {(scanning || visibleSteps.length > 0) && (
          <div className="mt-4">
            <ScanProgress steps={visibleSteps} />
          </div>
        )}
        {scanResult && <p className="mt-3 text-sm text-black/60">{scanResult}</p>}
      </Card>

      <Card className="mb-8" padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0">
          <SectionHeading eyebrow="Results" title="Ranked target companies" />
          <div className="mb-4 flex gap-2">
            <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="rounded-md border border-black/10 px-2 py-1 text-xs">
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={filterVertical} onChange={(e) => setFilterVertical(e.target.value)} className="rounded-md border border-black/10 px-2 py-1 text-xs">
              <option value="">All sectors</option>
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-5 pb-5">
          {!prospects ? (
            <Skeleton className="h-72 w-full" />
          ) : prospects.length === 0 ? (
            <EmptyState title="No prospects yet" detail="Run a market scan above to discover companies." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {prospects.map((p) => {
                const why: string[] = JSON.parse(p.whyJson);
                const awaitingOutreach = p.outreach.some((o) => o.status === "AWAITING_APPROVAL");
                return (
                  <Link
                    key={p.id}
                    href={`/scout/${p.id}`}
                    className="flex flex-col gap-2 rounded-xl2 border border-black/5 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-black/85">{p.companyName}</p>
                        <p className="text-xs text-black/45">
                          {p.country} · {p.vertical}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-semibold text-scout">{Math.round(p.opportunityScore)}</span>
                        <span className="text-[10px] text-black/35">/100</span>
                      </div>
                    </div>
                    <ProgressBar value={p.opportunityScore} max={100} colorClass="bg-scout" />
                    <p className="line-clamp-1 text-xs text-black/50">{why[0]}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="scout">{p.useCase?.split(" / ")[0]}</Badge>
                      {awaitingOutreach && <Badge tone="warning">Outreach awaiting approval</Badge>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeading eyebrow="Activity" title="Previous scans" />
        {!history || history.length === 0 ? (
          <EmptyState title="No scan history yet" />
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm">
                <div>
                  <p className="text-black/75">{h.summary ?? "Scan"}</p>
                  <p className="text-xs text-black/40">{new Date(h.startedAt).toLocaleString()}</p>
                </div>
                <Badge tone={h.status === "SUCCEEDED" ? "positive" : h.status === "FAILED" ? "negative" : "neutral"}>{h.status.toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
