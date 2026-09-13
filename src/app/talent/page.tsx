"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Card, Badge, ConfidenceBadge, Button, SectionHeading, EmptyState, Skeleton, ProgressBar } from "@/components/ui/primitives";
import { CorrelationBarChart } from "@/components/charts/Charts";
import { CANDIDATE_CSV_TEMPLATE_HEADERS } from "@/lib/csv";

interface Insight {
  id: string;
  kind: "CORRELATION" | "RECOMMENDATION";
  factor: string;
  title: string;
  description: string;
  sampleSize: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  correlation: number | null;
  confoundersJson: string;
}
interface WeightProposal {
  id: string;
  factor: string;
  oldWeight: number;
  newWeight: number;
  rationale: string;
  status: string;
}
interface Summary {
  candidateCount: number;
  hiredCount: number;
  withOutcomeCount: number;
  insights: Insight[];
  weightProposals: WeightProposal[];
  latestRun: {
    summary: string | null;
    startedAt: string;
    llmSummary: string | null;
    llmProvider: string | null;
    llmModel: string | null;
  } | null;
  movers: { candidateId: string; oldRank: number; newRank: number; delta: number; candidate: { name: string } }[];
}
interface ModelFactor {
  key: string;
  label: string;
  r: number;
  n: number;
}
interface ModelCandidate {
  id: string;
  name: string;
  originalSourcingScore: number;
  hired: boolean;
  values: Record<string, number>;
}
interface ModelData {
  factors: ModelFactor[];
  candidates: ModelCandidate[];
}

const STAGE_LABELS = ["SOURCE", "INTERVIEW", "HIRE", "PERFORMANCE", "LEARN", "IMPROVE SOURCING"];

function FeedbackLoop({ candidateCount, hiredCount, withOutcomeCount }: { candidateCount: number; hiredCount: number; withOutcomeCount: number }) {
  const counts = [candidateCount, candidateCount, hiredCount, withOutcomeCount, "", ""];
  return (
    <Card className="mb-8">
      <SectionHeading eyebrow="How this product works" title="The sourcing feedback loop" detail="Every stage below feeds real counts from your data into the next." />
      <div className="flex flex-wrap items-stretch gap-2">
        {STAGE_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="min-w-[112px] rounded-lg border border-talent/20 bg-talent-soft px-3 py-2.5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-talent">{label}</p>
              {counts[i] !== "" && <p className="mt-1 text-sm font-semibold text-black/80">{counts[i]}</p>}
            </div>
            {i < STAGE_LABELS.length - 1 && <span className="text-black/25">→</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReweightPanel({ model }: { model: ModelData }) {
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(model.factors.map((f) => [f.key, Math.abs(f.r)]))
  );

  const ranked = useMemo(() => {
    const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    const scored = model.candidates.map((c) => {
      const score = model.factors.reduce((sum, f) => {
        const w = (weights[f.key] ?? 0) / totalW;
        const sign = f.r >= 0 ? 1 : -1;
        return sum + w * (c.values[f.key] ?? 0) * sign;
      }, 0);
      return { ...c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const withRank = scored.map((c, i) => ({ ...c, newRank: i + 1 }));

    const byOldScore = [...model.candidates].sort((a, b) => b.originalSourcingScore - a.originalSourcingScore);
    const oldRank = new Map(byOldScore.map((c, i) => [c.id, i + 1]));

    return withRank
      .map((c) => ({ ...c, oldRank: oldRank.get(c.id) ?? 0 }))
      .sort((a, b) => a.newRank - b.newRank);
  }, [weights, model]);

  return (
    <Card className="mb-8">
      <SectionHeading
        eyebrow="Interactive"
        title="Adjust sourcing weights"
        detail="Drag a factor's weight and watch the ranking reorder immediately — nothing is saved until you approve a proposal below."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          {model.factors.map((f) => (
            <div key={f.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-black/70">{f.label}</span>
                <span className="text-black/40">r={f.r.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={weights[f.key]}
                onChange={(e) => setWeights((w) => ({ ...w, [f.key]: Number(e.target.value) }))}
                className="w-full accent-talent"
              />
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setWeights(Object.fromEntries(model.factors.map((f) => [f.key, Math.abs(f.r)])))}>
            Reset to learned weights
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-black/5">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-xs text-black/40">
              <tr className="border-b border-black/5">
                <th className="px-3 py-2 text-left font-medium">Candidate</th>
                <th className="px-3 py-2 text-right font-medium">Old rank</th>
                <th className="px-3 py-2 text-right font-medium">New rank</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 15).map((c) => {
                const delta = c.oldRank - c.newRank;
                return (
                  <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                    <td className="px-3 py-2">
                      <Link href={`/talent/candidates/${c.id}`} className="hover:underline">
                        {c.name}
                      </Link>
                      {c.hired && <Badge tone="positive" className="ml-2">hired</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right text-black/50">#{c.oldRank}</td>
                    <td className="px-3 py-2 text-right font-medium">#{c.newRank}</td>
                    <td className={`px-3 py-2 text-right font-medium ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-black/30"}`}>
                      {delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

interface CandidateListItem {
  id: string;
  name: string;
  currentTitle: string;
  technicalDomain: string;
  geography: string;
  originalSourcingScore: number;
  startupExperience: boolean;
  hire: { hired: boolean } | null;
  rankings: { newRank: number; oldRank: number }[];
}

function CandidateBrowser() {
  const [candidates, setCandidates] = useState<CandidateListItem[] | null>(null);
  const [domain, setDomain] = useState("");
  const [hiredOnly, setHiredOnly] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (domain) params.set("domain", domain);
    if (hiredOnly) params.set("hiredOnly", "1");
    fetch(`/api/talent/candidates?${params}`)
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates));
  }, [domain, hiredOnly]);

  const domains = ["Backend", "Frontend", "Data/ML", "DevOps/Infra", "Mobile", "Full-stack"];

  return (
    <Card className="mb-8">
      <SectionHeading eyebrow="Candidate history" title="Browse sourced candidates" />
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className="rounded-md border border-black/10 px-2 py-1 text-xs">
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 text-xs">
          <input type="checkbox" checked={hiredOnly} onChange={(e) => setHiredOnly(e.target.checked)} />
          Hired only
        </label>
      </div>
      {!candidates ? (
        <Skeleton className="h-64 w-full" />
      ) : candidates.length === 0 ? (
        <EmptyState title="No candidates match these filters" />
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-black/5">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-xs text-black/40">
              <tr className="border-b border-black/5">
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Domain</th>
                <th className="px-3 py-2 text-left font-medium">Geography</th>
                <th className="px-3 py-2 text-right font-medium">Sourcing score</th>
                <th className="px-3 py-2 text-right font-medium">Learned rank</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-3 py-2">
                    <Link href={`/talent/candidates/${c.id}`} className="font-medium text-black/80 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-black/60">{c.technicalDomain}</td>
                  <td className="px-3 py-2 text-black/60">{c.geography}</td>
                  <td className="px-3 py-2 text-right">{c.originalSourcingScore}</td>
                  <td className="px-3 py-2 text-right">{c.rankings[0] ? `#${c.rankings[0].newRank}` : "—"}</td>
                  <td className="px-3 py-2">
                    {c.hire?.hired ? <Badge tone="positive">Hired</Badge> : <Badge tone="neutral">Not hired</Badge>}
                    {c.startupExperience && (
                      <Badge tone="talent" className="ml-1">
                        Startup exp
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function TalentPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [model, setModel] = useState<ModelData | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = () => {
    fetch("/api/talent/summary").then((r) => r.json()).then(setSummary);
    fetch("/api/talent/model").then((r) => r.json()).then(setModel);
  };

  useEffect(() => {
    load();
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    await fetch("/api/talent/analyze", { method: "POST" });
    load();
    setAnalyzing(false);
  };

  const decideProposal = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const items = await fetch(`/api/approvals?status=PENDING`).then((r) => r.json());
    const match = items.items.find((i: { entityId: string }) => i.entityId === id);
    if (match) {
      await fetch(`/api/approvals/${match.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      load();
    }
  };

  const handleUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/talent/csv", { method: "POST", body: form });
    const data = await res.json();
    setUploadMsg(res.ok ? `Imported ${data.created}/${data.totalRows} rows.` : data.error);
    load();
  };

  const correlationInsights = summary?.insights.filter((i) => i.kind === "CORRELATION") ?? [];
  const recommendationInsights = summary?.insights.filter((i) => i.kind === "RECOMMENDATION") ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <ProductHeader
        name="Talent Intelligence"
        tagline="A closed-loop recruiting intelligence system: it learns which sourced candidates actually became successful employees, and proposes sourcing changes — with your approval."
        accentText="text-talent"
        accentBg="bg-talent-soft"
        right={
          <Button accent="talent" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? "Analyzing…" : "Re-run analysis"}
          </Button>
        }
      />

      {!summary || !model ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <FeedbackLoop candidateCount={summary.candidateCount} hiredCount={summary.hiredCount} withOutcomeCount={summary.withOutcomeCount} />

          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-black/40">Candidates tracked</p>
              <p className="mt-1 text-2xl font-semibold">{summary.candidateCount}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-black/40">Hired</p>
              <p className="mt-1 text-2xl font-semibold">{summary.hiredCount}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-black/40">With performance data</p>
              <p className="mt-1 text-2xl font-semibold">{summary.withOutcomeCount}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-black/40">Last analysis</p>
              <p className="mt-1 text-sm font-medium text-black/70">{summary.latestRun ? new Date(summary.latestRun.startedAt).toLocaleString() : "—"}</p>
            </Card>
          </div>

          <Card className="mb-8">
            <SectionHeading
              eyebrow="Statistical analysis"
              title="What correlates with post-hire success"
              detail="Observed correlations only — every finding shows its sample size and confidence. No causal claims."
            />
            {correlationInsights.length === 0 ? (
              <EmptyState title="No correlations yet" detail="Run analysis to compute findings from candidate history." />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <CorrelationBarChart
                  color="#6d5efc"
                  data={correlationInsights.map((i) => ({ label: i.title.split(" correlates")[0].split(" vs")[0], r: i.correlation ?? 0 }))}
                />
                <div className="space-y-3">
                  {correlationInsights.map((i) => (
                    <div key={i.id} className="rounded-lg border border-black/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-black/80">{i.title}</p>
                        <ConfidenceBadge level={i.confidence} />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-black/50">{i.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-black/40">
                        <span>n={i.sampleSize}</span>
                        {i.correlation != null && <span>r={i.correlation.toFixed(2)}</span>}
                        {(JSON.parse(i.confoundersJson) as string[]).map((c, ci) => (
                          <span key={ci} className="rounded bg-black/[0.04] px-1.5 py-0.5">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {summary.latestRun?.llmSummary && (
            <Card className="mb-8">
              <div className="mb-2 flex items-center justify-between">
                <SectionHeading eyebrow="LLM interpretation" title="What the analysis means" />
                <Badge tone={summary.latestRun.llmProvider === "live" ? "positive" : "neutral"}>
                  {summary.latestRun.llmProvider === "live" ? `Live · ${summary.latestRun.llmModel}` : "Demo interpretation"}
                </Badge>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-black/65">{summary.latestRun.llmSummary}</p>
            </Card>
          )}

          <ReweightPanel model={model} />

          <Card className="mb-8">
            <SectionHeading
              eyebrow="Human approval required"
              title="Proposed sourcing weight changes"
              detail="These are recommendations only. Nothing changes the live sourcing weights until you approve."
            />
            {recommendationInsights.length === 0 ? (
              <EmptyState title="No pending recommendations" />
            ) : (
              <div className="space-y-3">
                {summary.weightProposals
                  .filter((p) => p.status === "PENDING")
                  .map((p) => (
                    <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-black/80">
                          {p.factor}: {(p.oldWeight * 100).toFixed(0)}% → {(p.newWeight * 100).toFixed(0)}%
                        </p>
                        <p className="mt-0.5 text-xs text-black/50">{p.rationale}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" accent="talent" onClick={() => decideProposal(p.id, "APPROVED")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => decideProposal(p.id, "REJECTED")}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <Card className="mb-8">
            <SectionHeading
              eyebrow="From the last full analysis run"
              title="Biggest ranking movers"
              detail="Candidates whose rank shifted most between the original sourcing score and the learned ranking."
            />
            {summary.movers.length === 0 ? (
              <EmptyState title="No ranking history yet" />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {summary.movers.map((m) => (
                  <Link
                    key={m.candidateId}
                    href={`/talent/candidates/${m.candidateId}`}
                    className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm hover:bg-black/[0.02]"
                  >
                    <span className="text-black/75">{m.candidate.name}</span>
                    <span className={`font-medium ${m.delta > 0 ? "text-emerald-600" : m.delta < 0 ? "text-rose-600" : "text-black/40"}`}>
                      #{m.oldRank} → #{m.newRank} {m.delta > 0 ? `(↑${m.delta})` : m.delta < 0 ? `(↓${Math.abs(m.delta)})` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <CandidateBrowser />

          <Card className="mb-8">
            <SectionHeading
              eyebrow="Ingestion layer"
              title="Import candidate history"
              detail={`CSV connector. Expected columns: ${CANDIDATE_CSV_TEMPLATE_HEADERS.join(", ")}`}
            />
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="text-sm text-black/60 file:mr-3 file:rounded-md file:border-0 file:bg-talent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-talent"
            />
            {uploadMsg && <p className="mt-2 text-xs text-black/50">{uploadMsg}</p>}
          </Card>
        </>
      )}
    </main>
  );
}
