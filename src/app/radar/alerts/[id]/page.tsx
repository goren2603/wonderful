"use client";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, ConfidenceBadge, Button, SectionHeading, Skeleton } from "@/components/ui/primitives";
import { TrendLineChart } from "@/components/charts/Charts";

interface AlertDetail {
  id: string;
  title: string;
  type: "RISK" | "OPPORTUNITY" | "PRODUCT_SIGNAL";
  severity: "LOW" | "MEDIUM" | "HIGH";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  state: "WORSENING" | "IMPROVING" | "STABLE" | "RESOLVED";
  evidenceCount: number;
  baseline: string;
  trend: string;
  aiExplanation: string;
  recommendedAction: string;
  status: string;
  theme: { label: string; category: string } | null;
}
interface Mention {
  id: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  sourceDate: string;
  audienceLens: string;
  sentiment: string;
  isDemo: boolean;
}

const TYPE_LABEL: Record<AlertDetail["type"], string> = { RISK: "Risk", OPPORTUNITY: "Opportunity", PRODUCT_SIGNAL: "Product signal" };
const TYPE_TONE: Record<AlertDetail["type"], "negative" | "positive" | "warning"> = { RISK: "negative", OPPORTUNITY: "positive", PRODUCT_SIGNAL: "warning" };

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [trend, setTrend] = useState<{ weekStart: string; mentionCount: number }[]>([]);

  const load = () =>
    fetch(`/api/radar/alerts/${params.id}${window.location.search}`)
      .then((r) => r.json())
      .then((d) => {
        setAlert(d.alert);
        setMentions(d.mentions);
        setTrend(d.trend);
      });

  useEffect(() => {
    load();
  }, [params.id]);

  const setStatus = async (status: string) => {
    await fetch(`/api/radar/alerts/${params.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  const feedback = async (vote: "UP" | "DOWN") => {
    await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetType: "ALERT", targetId: params.id, vote }) });
  };

  if (!alert) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link href="/radar" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-black/40 hover:text-black/70">
        ← External Radar
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONE[alert.type]}>{TYPE_LABEL[alert.type]}</Badge>
            <Badge tone={alert.severity === "HIGH" ? "negative" : alert.severity === "MEDIUM" ? "warning" : "neutral"}>{alert.severity.toLowerCase()} severity</Badge>
            <ConfidenceBadge level={alert.confidence} />
            <Badge tone={alert.state === "WORSENING" ? "negative" : alert.state === "IMPROVING" ? "positive" : "neutral"}>{alert.state.toLowerCase()}</Badge>
          </div>
          <h1 className="text-2xl font-semibold text-black/90">{alert.title.replace(/^(Risk|Opportunity|Signal): /, "")}</h1>
          {alert.theme && <p className="text-sm text-black/45">Theme: {alert.theme.label}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => feedback("UP")} className="rounded-md border border-black/10 px-2 py-1.5 text-sm hover:bg-black/5" title="Useful alert">👍</button>
          <button onClick={() => feedback("DOWN")} className="rounded-md border border-black/10 px-2 py-1.5 text-sm hover:bg-black/5" title="Not useful">👎</button>
        </div>
      </div>

      <Card className="mb-6">
        <SectionHeading eyebrow="What changed" title={alert.trend} />
        <TrendLineChart color="#e8622c" data={trend.map((tp) => ({ week: new Date(tp.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: tp.mentionCount }))} />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">Baseline</p>
            <p className="text-black/70">{alert.baseline}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">How the theme formed</p>
            <p className="text-black/70">Individual mentions clustered by shared language, then compared week-by-week against the baseline above.</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow="Why it matters" title="Explanation" />
        <p className="mb-4 text-sm leading-relaxed text-black/65">{alert.aiExplanation}</p>
        <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40">What to do</p>
          <p className="text-sm text-black/70">{alert.recommendedAction}</p>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow={`${mentions.length} mentions`} title="What the evidence is" />
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {mentions.map((m) => (
            <div key={m.id} className="rounded-lg border border-black/5 p-3 text-sm">
              <p className="text-black/70">&ldquo;{m.text}&rdquo;</p>
              {m.isDemo && <Badge tone="warning">Synthetic scenario — not a verified report</Badge>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-black/40">
                <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline">{m.sourceName}</a>
                <span>{new Date(m.sourceDate).toLocaleDateString()}</span>
                <Badge tone="neutral">{m.audienceLens.toLowerCase()}</Badge>
                <Badge tone={m.sentiment === "POSITIVE" ? "positive" : m.sentiment === "NEGATIVE" ? "negative" : "neutral"}>{m.sentiment.toLowerCase()}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading eyebrow="Status" title={alert.status.replace(/_/g, " ").toLowerCase()} />
        <div className="flex gap-2">
          <Button size="sm" accent="radar" onClick={() => setStatus("ACKNOWLEDGED")} disabled={alert.status === "ACKNOWLEDGED"}>Acknowledge</Button>
          <Button size="sm" variant="secondary" onClick={() => setStatus("DISMISSED")} disabled={alert.status === "DISMISSED"}>Dismiss</Button>
        </div>
      </Card>
    </main>
  );
}
