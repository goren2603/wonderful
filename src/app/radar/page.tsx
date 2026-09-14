"use client";
import { RunHistory } from "@/components/layout/RunHistory";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Card, Badge, ConfidenceBadge, DemoBadge, LiveBadge, Button, SectionHeading, EmptyState, Skeleton } from "@/components/ui/primitives";
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
  isDemo: boolean;
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
  lastWeekCount: number;
  executiveCount: number;
}
interface Mention {
  id: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  audienceLens: string;
  sentiment: string;
  isDemo: boolean;
}
interface Overview {
  leadership: null | {
    people: { name: string; role: string }[]; sourceUrl: string; verifiedAt: string;
    articles: { id: string; title: string; sourceUrl: string; sourceName: string; sourceDate: string; fetchedAt: string; people: string[]; nameInMetadata: boolean }[];
    lastScan: null | { at: string; stored: number; fetched: number; errors: string[] };
  };
  company: Company;
  themes: Theme[];
  alerts: Alert[];
  mentions: Mention[];
  sentimentCounts: Record<string, number>;
  executiveMentionCount: number;
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
      {alert.isDemo && <DemoBadge />}
      <p className="text-sm font-semibold text-black/85">{alert.title.replace(/^(Risk|Opportunity|Signal): /, "")}</p>
      <p className="text-sm font-medium text-black/70">{alert.lastWeekCount} this week{alert.executiveCount > 0 ? ` · ${alert.executiveCount} from executives` : ""}</p>
      <p className="text-xs text-black/45">{alert.trend}</p>
      <p className="line-clamp-2 text-xs text-black/45">{alert.aiExplanation}</p>
      <div className="mt-1 flex items-center justify-between">
        <ConfidenceBadge level={alert.confidence} />
        <span className="text-xs text-black/40">{alert.evidenceCount} signals</span>
      </div>
    </Link>
  );
}

function SubscribeBar() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const submit = async () => {
    if (!email.trim()) return;
    setStatus("saving");
    const res = await fetch("/api/radar/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    setStatus(res.ok ? "done" : "error");
  };
  const unsubscribe = async () => {
    await fetch("/api/radar/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    setStatus("idle");
    setEmail("");
  };
  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
        <span>✓ Subscription saved. Delivery requires a configured email provider and {5}+ real negative mentions in a week.</span>
        <button onClick={unsubscribe} className="underline">Unsubscribe</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" type="email" className="w-44 rounded-full border border-black/10 px-3 py-1 text-xs" onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Button size="sm" variant="secondary" onClick={submit} disabled={status === "saving"}>Get email alerts</Button>
      {status === "error" && <span className="text-xs text-rose-600">Failed — try again</span>}
    </div>
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

  const [addingCompany, setAddingCompany] = useState(false);
  const addCompany = async () => {
    if (!newCompanyName.trim()) return;
    setAddingCompany(true);
    try {
      const res = await fetch("/api/radar/companies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newCompanyName.trim() }) });
      const data = await res.json();
      if (data.company) {
        setCompanies((c) => (c.find((x) => x.id === data.company.id) ? c : [...c, data.company]));
        setActiveCompany(data.company.name);
        loadOverview();
      }
      setNewCompanyName("");
    } finally {
      setAddingCompany(false);
    }
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

      <div className="mb-4 flex justify-end">
        <SubscribeBar />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-black/40">Tracking</span>
          {companies.map((c) => (
            <button key={c.id} onClick={() => setActiveCompany(c.name)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${activeCompany === c.name ? "border-radar bg-radar-soft text-radar" : "border-black/10 text-black/50"}`}>
              {c.name}{c.isDefault && " (sample data)"}
            </button>
          ))}
          <div className={`flex items-center gap-2 rounded-xl2 border-2 border-dashed px-3 py-1.5 transition ${addingCompany ? "border-radar bg-radar-soft" : "border-black/15"}`}>
            <span className="text-sm text-black/30">🔍</span>
            <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Track a competitor by name…" className="w-48 bg-transparent text-xs outline-none placeholder:text-black/40" onKeyDown={(e) => e.key === "Enter" && addCompany()} disabled={addingCompany} />
            <Button size="sm" variant="secondary" onClick={addCompany} disabled={addingCompany}>{addingCompany ? "Fetching real data…" : "Add"}</Button>
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

      {overview?.leadership && (
        <Card className="mb-8 border border-radar/20">
          <SectionHeading eyebrow="Named leadership · live public news" title="Wonderful leadership in the news" detail="News search results for our watched leaders and Wonderful. Checked by the same scheduled Radar agent; no CRM or private access needed." />
          <div className="mb-3 flex flex-wrap gap-2">
            {overview.leadership.people.map(p => <span key={p.name} className="rounded-full bg-radar-soft px-3 py-1 text-xs">{p.name} · {p.role}</span>)}
          </div>
          <p className="mb-3 text-xs text-black/50"><a href={overview.leadership.sourceUrl} target="_blank" rel="noreferrer" className="underline">Official leadership source</a> · Watchlist checked {overview.leadership.verifiedAt}. News coverage: English Google News index, latest 90 days; not exhaustive.</p>
          {overview.leadership.lastScan ? <p className="mb-3 text-sm">Last checked {new Date(overview.leadership.lastScan.at).toLocaleString()} · {overview.leadership.lastScan.stored} new articles saved · {overview.leadership.articles.length} stored articles</p> : <p className="mb-3 text-sm">First leadership check is pending. The scheduled scan will collect public articles.</p>}
          {!!overview.leadership.lastScan?.errors.length && <p role="status" className="mb-3 text-sm text-amber-800">Some news searches failed. Coverage is incomplete; this does not mean no news. {overview.leadership.lastScan.errors.join('; ')}</p>}
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {overview.leadership.articles.map(a => <article key={a.id} className="rounded-lg border border-black/10 p-3">
              <p className="mb-1 text-xs text-radar">Search for {a.people.join(', ')} · {a.sourceName} · Published {new Date(a.sourceDate).toLocaleDateString()}</p>
              <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium underline">{a.title}</a>
              <p className="mt-1 text-xs text-black/50">First captured {new Date(a.fetchedAt).toLocaleDateString()} · {a.nameInMetadata ? "Name and company appear in news metadata." : "Name matched by the search index; not verified in article text."} Open the article to verify its claims.</p>
            </article>)}
          </div>
          {!overview.leadership.articles.length && overview.leadership.lastScan && <p className="text-sm text-black/60">No matching articles stored yet. We do not substitute sample stories.</p>}
          <p className="mt-3 text-xs text-black/50">A new article is a change in coverage, not automatically a risk or endorsement. This section is independent of the audience lens below.</p>
          <Button variant="secondary" onClick={runScan} disabled={scanning}>{scanning ? 'Checking public sources…' : 'Check public sources now'}</Button>
          {scanMsg && <p role="status" className="mt-2 text-xs">{scanMsg}</p>}
        </Card>
      )}

      {!overview ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : overview.alerts.length === 0 && overview.themes.length === 0 ? (
        <>
          {overview.company.isDefault ? (
            <>
              <EmptyState title={`No signal tracked yet for ${activeCompany}`} detail="No mentions loaded yet. Load the sample scenario to explore clustering and alerts for this company." />
              <div className="mt-4"><Button variant="secondary" onClick={loadScenario}>Load sample scenario</Button></div>
            </>
          ) : (
            <EmptyState title={`No live public evidence found yet for ${activeCompany}`} detail="This company was searched against real public sources (Wikipedia, Hacker News) and nothing usable came back — check the spelling, or it may just have little public footprint. It's rechecked automatically on every scan." />
          )}
          {scanMsg && <p className="mt-3 text-sm text-black/50">{scanMsg}</p>}
        </>
      ) : (
        <>
          <SectionHeading eyebrow={activeCompany} title="What changed this week" detail="Every signal below answers: what changed, why it matters, what the evidence is, and what to do. Computed weekly, not daily — see each card for the exact window." />
          <div className="mb-3 flex gap-3 text-xs text-black/45">
            <span>{alertsByType.RISK} risk</span>
            <span>{alertsByType.OPPORTUNITY} opportunity</span>
            <span>{alertsByType.PRODUCT_SIGNAL} product signal</span>
            <span>· {overview.executiveMentionCount} mentions from an executive audience</span>
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
              {overview.mentions.every((m) => m.isDemo) ? <DemoBadge /> : overview.mentions.every((m) => !m.isDemo) ? <LiveBadge /> : <span className="text-[10px] font-medium text-black/40">Mixed live/demo</span>}
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {overview.mentions.slice(0, 30).map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-black/5 px-3 py-2 text-sm">
                  <p className="text-black/70">
                    {m.isDemo ? (
                      `“${m.text}”`
                    ) : (
                      <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-radar">
                        &ldquo;{m.text}&rdquo;
                      </a>
                    )}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {m.isDemo ? <DemoBadge /> : <LiveBadge />}
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


