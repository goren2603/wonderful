"use client";
import { RunHistory } from "@/components/layout/RunHistory";
import { request as fetch } from "@/lib/client";

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
  type: "RISK" | "OPPORTUNITY" | "PRODUCT_SIGNAL";
  severity: "LOW" | "MEDIUM" | "HIGH";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  state: "WORSENING" | "IMPROVING" | "STABLE" | "RESOLVED";
  evidenceCount: number;
  trend: string;
  aiExplanation: string;
  recommendedAction: string;
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

const TYPE_STYLE: Record<Alert["type"], { border: string; bg: string; text: string; label: string }> = {
  RISK: { border: "border-rose-300", bg: "bg-rose-50", text: "text-rose-700", label: "RED — RISK" },
  OPPORTUNITY: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", label: "GREEN — OPPORTUNITY" },
  PRODUCT_SIGNAL: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-800", label: "ORANGE — PRODUCT SIGNAL" },
};

function SignalCard({ alert, lens }: { alert: Alert; lens: string }) {
  const style = TYPE_STYLE[alert.type] ?? TYPE_STYLE.RISK;
  return (
    <Link
      href={`/radar/alerts/${alert.id}${lens !== "ALL" ? `?lens=${lens}` : ""}`}
      className={`flex flex-col gap-2 rounded-xl2 border-2 ${style.border} ${style.bg} p-4 transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-wide ${style.text}`}>{style.label}</span>
        <Badge tone={alert.state === "WORSENING" ? "negative" : alert.state === "IMPROVING" ? "positive" : "neutral"}>{alert.state.toLowerCase()}</Badge>
      </div>
      <p className="text-sm font-semibold text-black/85">{alert.title.replace(/^(Risk|Opportunity|Signal): /, "")}</p>
      <p className="text-xs text-black/55">{alert.trend}</p>
      <p className="line-clamp-2 text-xs text-black/45">{alert.aiExplanation}</p>
      <div className="mt-1 flex items-center justify-between">
        <ConfidenceBadge level={alert.confidence} />
        <span className="text-xs text-black/40">{alert.evidenceCount} signals</span>
      </div>
    </Link>
  );
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
    fetch("/api/radar/companies").then((r) => r.json()).then((d) => setCompanies(d.companies));
  }, []);

  const loadOverview = () => {
    const params = new URLSearchParams({ company: activeCompany });
    if (lens !== "ALL") params.set("lens", lens);
    fetch(`/api/radar/overview?${params}`).then((r) => r.json()).then((d) => (d.error ? setOverview(null) : setOverview(d)));
  };

  useEffect(() => {
    loadOverview();
  }, [activeCompany, lens]);

  const runScan = async () => {
    setScanning(true);
    try {
      setScanMsg(null);
      const res = await fetch("/api/radar/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: activeCompany }) });
      const data = await res.json();
      setScanMsg(res.ok ? data.result.summary : data.error);
      loadOverview();
    } finally {
      setScanning(false);
    }
  };

  const loadScenario = async () => {
    const r = await fetch("/api/radar/scenario", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: activeCompany }) });
    const d = await r.json();
    setScanMsg(d.result.summary);
    loadOverview();
  };

  const addCompany = async () => {
    if (!newCompanyName.trim()) return;
    const res = await fetch("/api/radar/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newCompanyName.trim() }) });
    const data = await res.json();
    if (data.company) {
      setCompanies((c) => (c.find((x) => x.id === data.company.id) ? c : [...c, data.company]));
      setActiveCompany(data.company.name);
    }
    setNewCompanyName("");
  };

  const alertsByType = { RISK: 0, OPPORTUNITY: 0, PRODUCT_SIGNAL: 0 };
  overview?.alerts.forEach((a) => alertsByType[a.type]++);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <ProductHeader
        name="External Radar"
        tagline="An autonomous early-warning and opportunity intelligence agent, continuously monitoring public signal. Mention → theme → trend → alert — the dashboard below is the output, not a control panel you need to operate."
        accentText="text-radar"
        accentBg="bg-radar-soft"
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-black/40">Tracking</span>
          {companies.map((c) => (
            <button key={c.id} onClick={() => setActiveCompany(c.name)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${activeCompany === c.name ? "border-radar bg-radar-soft text-radar" : "border-black/10 text-black/50"}`}>
              {c.name}{c.isDefault && " (demo)"}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Add any company…" className="w-36 rounded-full border border-black/10 px-3 py-1 text-xs" onKeyDown={(e) => e.key === "Enter" && addCompany()} />
            <Button size="sm" variant="secondary" onClick={addCompany}>Add</Button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-black/40">Lens</span>
          {LENSES.map((l) => (
            <button key={l} onClick={() => setLens(l)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${lens === l ? "bg-radar text-white" : "bg-black/5 text-black/50"}`}>
              {l === "ALL" ? "All" : l.charAt(0) + l.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {!overview ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : overview.alerts.length === 0 && overview.themes.length === 0 ? (
        <>
          <EmptyState title={`No signal tracked yet for ${activeCompany}`} detail="No live provider is connected in this environment. Load the sample scenario to explore clustering and alerts for this company." />
          <div className="mt-4"><Button variant="secondary" onClick={loadScenario}>Load sample scenario</Button></div>
          {scanMsg && <p className="mt-3 text-sm text-black/50">{scanMsg}</p>}
        </>
      ) : (
        <>
          <SectionHeading eyebrow={activeCompany} title="What changed since yesterday" detail="Every signal below answers: what changed, why it matters, what the evidence is, and what to do." />
          <div className="mb-3 flex gap-3 text-xs text-black/45">
            <span>{alertsByType.RISK} risk</span>
            <span>{alertsByType.OPPORTUNITY} opportunity</span>
            <span>{alertsByType.PRODUCT_SIGNAL} product signal</span>
          </div>
          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {overview.alerts.map((a) => (
              <SignalCard key={a.id} alert={a} lens={lens} />
            ))}
          </div>

          <SectionHeading eyebrow="Over time" title="Emerging themes" detail="Mention volume per theme, week by week — this is how each alert above was formed." />
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {overview.themes.map((t) => (
              <Card key={t.id}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium text-black/80">{t.label}</p>
                  <span className="text-xs text-black/40">{t._count.mentions} mentions</span>
                </div>
                <p className="mb-2 text-xs text-black/40">{t.category}</p>
                <TrendLineChart color="#e8622c" data={t.trend.map((tp) => ({ week: new Date(tp.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: tp.mentionCount }))} />
              </Card>
            ))}
          </div>

          <Card className="mb-8">
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
                    <Badge tone={m.sentiment === "POSITIVE" ? "positive" : m.sentiment === "NEGATIVE" ? "negative" : "neutral"}>{m.sentiment.toLowerCase()}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <details className="mb-8 rounded-xl2 border border-black/5 bg-white shadow-card">
            <summary className="cursor-pointer select-none p-5 text-sm font-medium text-black/70">Monitoring controls (the agent also runs automatically on a schedule)</summary>
            <div className="flex flex-wrap items-center gap-3 border-t border-black/5 p-5">
              <Button variant="secondary" onClick={runScan} disabled={scanning}>{scanning ? "Analyzing…" : "Re-analyze stored signals now"}</Button>
              <Button variant="ghost" onClick={loadScenario}>Load sample scenario</Button>
              {scanMsg && <p className="text-xs text-black/50">{scanMsg}</p>}
            </div>
          </details>
        </>
      )}
      <RunHistory agent="EXTERNAL_RADAR" />
    </main>
  );
}
