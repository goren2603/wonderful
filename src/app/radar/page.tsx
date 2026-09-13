"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Card, Badge, ConfidenceBadge, DemoBadge, Button, SectionHeading, EmptyState, Skeleton } from "@/components/ui/primitives";
import { TrendLineChart } from "@/components/charts/Charts";

const LENSES = ["ALL", "CANDIDATE", "CUSTOMER", "EXECUTIVE", "INVESTOR"] as const;

interface Company {
  id: string;
  name: string;
  isDefault: boolean;
}
interface Theme {
  id: string;
  label: string;
  category: string;
  trend: { weekStart: string; mentionCount: number }[];
  _count: { mentions: number };
}
interface Alert {
  id: string;
  title: string;
  type: "RISK" | "OPPORTUNITY";
  severity: "LOW" | "MEDIUM" | "HIGH";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceCount: number;
  trend: string;
  status: string;
  themeId: string | null;
}
interface Mention {
  id: string;
  text: string;
  sourceName: string;
  audienceLens: string;
  sentiment: string;
}
interface Overview {
  company: Company;
  themes: Theme[];
  alerts: Alert[];
  mentions: Mention[];
  sentimentCounts: Record<string, number>;
}

export default function RadarPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompany] = useState("Wonderful");
  const [lens, setLens] = useState<(typeof LENSES)[number]>("ALL");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");

  useEffect(() => {
    fetch("/api/radar/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies));
  }, []);

  const loadOverview = () => {
    const params = new URLSearchParams({ company: activeCompany });
    if (lens !== "ALL") params.set("lens", lens);
    fetch(`/api/radar/overview?${params}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setOverview(null) : setOverview(d)));
  };

  useEffect(() => {
    loadOverview();
  }, [activeCompany, lens]);

  const runScan = async () => {
    setScanning(true);
    setScanMsg(null);
    const res = await fetch("/api/radar/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ company: activeCompany }),
    });
    const data = await res.json();
    setScanMsg(res.ok ? `Checked sources — ${data.result.entitiesFound} new mention(s) found.` : data.error);
    loadOverview();
    setScanning(false);
  };

  const addCompany = async () => {
    if (!newCompanyName.trim()) return;
    const res = await fetch("/api/radar/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newCompanyName.trim() }),
    });
    const data = await res.json();
    if (data.company) {
      setCompanies((c) => (c.find((x) => x.id === data.company.id) ? c : [...c, data.company]));
      setActiveCompany(data.company.name);
    }
    setNewCompanyName("");
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <ProductHeader
        name="External Radar"
        tagline="An autonomous early-warning and opportunity intelligence agent. Turns scattered mentions into explained, confidence-scored alerts: mention → theme → trend → alert."
        accentText="text-radar"
        accentBg="bg-radar-soft"
        right={
          <Button accent="radar" onClick={runScan} disabled={scanning}>
            {scanning ? "Checking sources…" : "Check sources now"}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-black/40">Tracking</span>
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCompany(c.name)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeCompany === c.name ? "border-radar bg-radar-soft text-radar" : "border-black/10 text-black/50"
              }`}
            >
              {c.name}
              {c.isDefault && " (demo)"}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Add any company…"
              className="w-36 rounded-full border border-black/10 px-3 py-1 text-xs"
              onKeyDown={(e) => e.key === "Enter" && addCompany()}
            />
            <Button size="sm" variant="secondary" onClick={addCompany}>
              Add
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-black/40">Lens</span>
          {LENSES.map((l) => (
            <button
              key={l}
              onClick={() => setLens(l)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                lens === l ? "bg-radar text-white" : "bg-black/5 text-black/50"
              }`}
            >
              {l === "ALL" ? "All" : l.charAt(0) + l.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      {scanMsg && <p className="mb-4 text-sm text-black/50">{scanMsg}</p>}

      {!overview ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : overview.alerts.length === 0 && overview.themes.length === 0 ? (
        <EmptyState
          title={`No signal tracked yet for ${activeCompany}`}
          detail="Newly added companies start empty — click 'Check sources now' to begin monitoring, or connect a live source provider."
        />
      ) : (
        <>
          <SectionHeading eyebrow="Risk & opportunity" title="Alerts" detail="Each alert traces back to a theme built from real mention counts below." />
          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {overview.alerts.map((a) => (
              <Link
                key={a.id}
                href={`/radar/alerts/${a.id}`}
                className="flex flex-col gap-2 rounded-xl2 border border-black/5 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Badge tone={a.type === "RISK" ? "negative" : "positive"}>{a.type === "RISK" ? "Risk" : "Opportunity"}</Badge>
                  <Badge tone={a.severity === "HIGH" ? "negative" : a.severity === "MEDIUM" ? "warning" : "neutral"}>{a.severity.toLowerCase()} severity</Badge>
                </div>
                <p className="text-sm font-medium text-black/85">{a.title}</p>
                <p className="text-xs text-black/45">{a.trend}</p>
                <div className="mt-1 flex items-center justify-between">
                  <ConfidenceBadge level={a.confidence} />
                  <span className="text-xs text-black/40">{a.evidenceCount} mentions</span>
                </div>
              </Link>
            ))}
          </div>

          <SectionHeading eyebrow="Over time" title="Emerging themes" detail="Mention volume per theme, week by week." />
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {overview.themes.map((t) => (
              <Card key={t.id}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-black/80">{t.label}</p>
                  <span className="text-xs text-black/40">{t._count.mentions} mentions</span>
                </div>
                <p className="mb-2 text-xs text-black/40">{t.category}</p>
                <TrendLineChart
                  color="#e8622c"
                  data={t.trend.map((tp) => ({
                    week: new Date(tp.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                    count: tp.mentionCount,
                  }))}
                />
              </Card>
            ))}
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading eyebrow={`Lens: ${lens === "ALL" ? "All audiences" : lens}`} title="Recent mentions" />
              <DemoBadge />
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {overview.mentions.slice(0, 30).map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-black/5 px-3 py-2 text-sm">
                  <p className="text-black/70">&ldquo;{m.text}&rdquo;</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone="neutral">{m.audienceLens.toLowerCase()}</Badge>
                    <Badge tone={m.sentiment === "POSITIVE" ? "positive" : m.sentiment === "NEGATIVE" ? "negative" : "neutral"}>
                      {m.sentiment.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
