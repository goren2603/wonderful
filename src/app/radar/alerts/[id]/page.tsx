"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, ConfidenceBadge, Button, SectionHeading, Skeleton } from "@/components/ui/primitives";
import { TrendLineChart } from "@/components/charts/Charts";

interface AlertDetail {
  id: string;
  title: string;
  type: "RISK" | "OPPORTUNITY";
  severity: "LOW" | "MEDIUM" | "HIGH";
  confidence: "LOW" | "MEDIUM" | "HIGH";
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
}

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [trend, setTrend] = useState<{ weekStart: string; mentionCount: number }[]>([]);

  const load = () =>
    fetch(`/api/radar/alerts/${params.id}`)
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
    await fetch(`/api/radar/alerts/${params.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const feedback = async (vote: "UP" | "DOWN") => {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType: "ALERT", targetId: params.id, vote }),
    });
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
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={alert.type === "RISK" ? "negative" : "positive"}>{alert.type === "RISK" ? "Risk" : "Opportunity"}</Badge>
            <Badge tone={alert.severity === "HIGH" ? "negative" : alert.severity === "MEDIUM" ? "warning" : "neutral"}>{alert.severity.toLowerCase()} severity</Badge>
            <ConfidenceBadge level={alert.confidence} />
          </div>
          <h1 className="text-2xl font-semibold text-black/90">{alert.title}</h1>
          {alert.theme && <p className="text-sm text-black/45">Theme: {alert.theme.label}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => feedback("UP")} className="rounded-md border border-black/10 px-2 py-1.5 text-sm hover:bg-black/5" title="Useful alert">
            👍
          </button>
          <button onClick={() => feedback("DOWN")} className="rounded-md border border-black/10 px-2 py-1.5 text-sm hover:bg-black/5" title="Not useful">
            👎
          </button>
        </div>
      </div>

      <Card className="mb-6">
        <SectionHeading eyebrow="How the system formed this theme" title="Mention volume over time" />
        <TrendLineChart
          color="#e8622c"
          data={trend.map((tp) => ({ week: new Date(tp.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: tp.mentionCount }))}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">Baseline</p>
            <p className="text-black/70">{alert.baseline}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-black/40">Trend</p>
            <p className="text-black/70">{alert.trend}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow="Why the system thinks this matters" title="AI explanation" />
        <p className="mb-4 text-sm leading-relaxed text-black/65">{alert.aiExplanation}</p>
        <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40">Recommended action</p>
          <p className="text-sm text-black/70">{alert.recommendedAction}</p>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow={`${mentions.length} mentions`} title="Underlying evidence" />
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {mentions.map((m) => (
            <div key={m.id} className="rounded-lg border border-black/5 p-3 text-sm">
              <p className="text-black/70">&ldquo;{m.text}&rdquo;</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-black/40">
                <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  {m.sourceName}
                </a>
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
          <Button size="sm" accent="radar" onClick={() => setStatus("ACKNOWLEDGED")} disabled={alert.status === "ACKNOWLEDGED"}>
            Acknowledge
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setStatus("DISMISSED")} disabled={alert.status === "DISMISSED"}>
            Dismiss
          </Button>
        </div>
      </Card>
    </main>
  );
}
