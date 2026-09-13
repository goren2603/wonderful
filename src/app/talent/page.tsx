"use client";
import { RunHistory } from "@/components/layout/RunHistory";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductHeader } from "@/components/layout/ProductHeader";
import { Card, Badge, ConfidenceBadge, Button, SectionHeading, EmptyState, Skeleton } from "@/components/ui/primitives";
import { CANDIDATE_CSV_TEMPLATE_HEADERS } from "@/lib/csv";

interface FactorAuditRow {
  key: string;
  label: string;
  v1Weight: number;
  v2Weight: number;
  reason: string;
}
interface Evaluation {
  id: string;
  generatedAt: string;
  candidatesReviewed: number;
  hiresAnalyzed: number;
  trainSize: number;
  holdoutSize: number;
  kUsed: number;
  v1Precision: number;
  v2Precision: number;
  improvementPct: number | null;
  validationStatus: "PASSED" | "FAILED" | "INSUFFICIENT_DATA";
  highPerformerDefinition: string;
  factorAudit: FactorAuditRow[];
}
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
  rationale: string;
  status: string;
}
interface BatchRankingRow {
  candidateId: string;
  oldRank: number;
  newRank: number;
  oldScore: number;
  newScore: number;
  delta: number;
  candidate: { name: string; technicalDomain: string };
}
interface Summary {
  candidateCount: number;
  hiredCount: number;
  withOutcomeCount: number;
  interviewCount: number;
  insights: Insight[];
  weightProposals: WeightProposal[];
  evaluation: Evaluation | null;
  latestRun: {
    summary: string | null;
    startedAt: string;
    llmSummary: string | null;
    llmProvider: string | null;
    llmModel: string | null;
  } | null;
  batchRanking: BatchRankingRow[];
}

function ValidationHero({ evaluation }: { evaluation: Evaluation | null }) {
  if (!evaluation || evaluation.validationStatus === "INSUFFICIENT_DATA") {
    return (
      <Card className="mb-8">
        <SectionHeading eyebrow="Sourcing model review" title="Not enough outcomes yet" />
        <p className="text-sm text-black/55">
          The audit needs at least 20 hired candidates with a recorded manager rating, split into training and held-out groups, before it can validate a
          proposed model. It will run automatically as new outcomes arrive.
        </p>
      </Card>
    );
  }
  const passed = evaluation.validationStatus === "PASSED";
  return (
    <Card className="mb-8" padded={false}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionHeading eyebrow="Sourcing model review complete" title="Did the old sourcing model work?" />
          <Badge tone={passed ? "positive" : "warning"} className="text-xs">
            VALIDATION {evaluation.validationStatus}
          </Badge>
        </div>
        <p className="mb-6 text-sm text-black/55">
          {evaluation.candidatesReviewed.toLocaleString()} historical candidates reviewed · {evaluation.hiresAnalyzed} eventual hires analyzed · validated on{" "}
          {evaluation.holdoutSize} held-out candidates the model never trained on.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl2 border border-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Model V1</p>
            <p className="mt-1 text-3xl font-semibold text-black/80">{(evaluation.v1Precision * 100).toFixed(0)}%</p>
            <p className="mt-1 text-xs text-black/45">High-performer precision (top {evaluation.kUsed})</p>
          </div>
          <div className={`rounded-xl2 border p-4 ${passed ? "border-talent/30 bg-talent-soft" : "border-black/10"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${passed ? "text-talent" : "text-black/40"}`}>Proposed Model V2</p>
            <p className={`mt-1 text-3xl font-semibold ${passed ? "text-talent" : "text-black/80"}`}>{(evaluation.v2Precision * 100).toFixed(0)}%</p>
            <p className="mt-1 text-xs text-black/45">Validated high-performer precision</p>
          </div>
          <div className="rounded-xl2 border border-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">{passed ? "Improvement" : "Result"}</p>
            <p className={`mt-1 text-3xl font-semibold ${passed ? "text-emerald-600" : "text-rose-600"}`}>
              {evaluation.improvementPct != null ? `${evaluation.improvementPct >= 0 ? "+" : ""}${evaluation.improvementPct.toFixed(1)}%` : "N/A"}
            </p>
            <p className="mt-1 text-xs text-black/45">{passed ? "V2 beats V1 on held-out data" : "V2 did not beat V1 — not recommended"}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-black/40">High performer = {evaluation.highPerformerDefinition}.</p>
        <p className="mt-2 text-xs text-black/40">
          Read this as directional, not proof: at top {evaluation.kUsed} out of a {evaluation.holdoutSize}-candidate holdout, one differently-classified candidate shifts precision by roughly {(100 / evaluation.kUsed).toFixed(0)} points. A held-out test this small is a real, unbiased check — but not a claim of certainty.
        </p>
      </div>
    </Card>
  );
}

function FactorAudit({ factorAudit }: { factorAudit: FactorAuditRow[] }) {
  if (factorAudit.length === 0) return null;
  return (
    <Card className="mb-8">
      <SectionHeading eyebrow="What the audit found" title="What Model V1 got wrong" detail="Comparing what V1's score rewards against what actually predicted post-hire success." />
      <div className="space-y-3">
        {factorAudit.map((f) => (
          <div key={f.key} className="rounded-lg border border-black/5 p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-black/80">{f.label}</p>
              <p className="text-sm">
                <span className="text-black/45">V1 weight: </span>
                <span className="font-medium text-black/70">{(f.v1Weight * 100).toFixed(0)}%</span>
                <span className="mx-1.5 text-black/30">→</span>
                <span className="text-black/45">Recommended: </span>
                <span className={`font-medium ${Math.abs(f.v2Weight) > Math.abs(f.v1Weight) ? "text-emerald-600" : "text-rose-600"}`}>{(f.v2Weight * 100).toFixed(0)}%</span>
              </p>
            </div>
            <p className="text-xs leading-relaxed text-black/50">{f.reason}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BatchComparison({ rows }: { rows: BatchRankingRow[] }) {
  return (
    <Card className="mb-8">
      <SectionHeading
        eyebrow="Model V1 vs Model V2"
        title="A realistic new batch of candidates"
        detail="Recently sourced candidates whose outcome isn't known yet — ranked by the original model and by the proposed model. Click a candidate to see why they moved."
      />
      {rows.length === 0 ? (
        <EmptyState title="No new batch loaded yet" />
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-black/5">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-xs text-black/40">
              <tr className="border-b border-black/5">
                <th className="px-3 py-2 text-left font-medium">Candidate</th>
                <th className="px-3 py-2 text-left font-medium">Domain</th>
                <th className="px-3 py-2 text-right font-medium">V1 rank</th>
                <th className="px-3 py-2 text-right font-medium">V2 rank</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.candidateId} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                  <td className="px-3 py-2">
                    <Link href={`/talent/candidates/${r.candidateId}`} className="font-medium text-black/80 hover:underline">
                      {r.candidate.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-black/55">{r.candidate.technicalDomain}</td>
                  <td className="px-3 py-2 text-right text-black/50">#{r.oldRank}</td>
                  <td className="px-3 py-2 text-right font-medium">#{r.newRank}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-rose-600" : "text-black/30"}`}>
                    {r.delta > 0 ? `↑${r.delta}` : r.delta < 0 ? `↓${Math.abs(r.delta)}` : "—"}
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

interface CandidateListItem {
  id: string;
  name: string;
  currentTitle: string;
  technicalDomain: string;
  geography: string;
  originalSourcingScore: number;
  startupExperience: boolean;
  eliteUniversity: boolean;
  priorLeadership: boolean;
  hire: { hired: boolean } | null;
  performance: { department: string | null; roleHiredInto: string | null; retentionMonths: number | null; promotions: number; highPerformer: boolean; stillEmployed: boolean } | null;
}

function CandidateHistoryTable() {
  const [candidates, setCandidates] = useState<CandidateListItem[] | null>(null);
  const [domain, setDomain] = useState("");
  const [hiredOnly, setHiredOnly] = useState(false);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (domain) params.set("domain", domain);
    if (hiredOnly) params.set("hiredOnly", "1");
    fetch(`/api/talent/candidates?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setCandidates(d.candidates);
        setTotal(d.total);
      });
  }, [domain, hiredOnly, page]);

  const domains = ["Backend", "Frontend", "Data/ML", "DevOps/Infra", "Mobile", "Full-stack"];

  return (
    <details className="mb-8 rounded-xl2 border border-black/5 bg-white shadow-card">
      <summary className="cursor-pointer select-none p-5 text-sm font-medium text-black/70">Supporting evidence — full historical candidate table</summary>
      <div className="border-t border-black/5 p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <select value={domain} onChange={(e) => { setDomain(e.target.value); setPage(1); }} className="rounded-md border border-black/10 px-2 py-1 text-xs">
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 text-xs">
            <input type="checkbox" checked={hiredOnly} onChange={(e) => { setHiredOnly(e.target.checked); setPage(1); }} />
            Hired only
          </label>
        </div>
        <div className="mb-3 flex items-center gap-3 text-xs">
          <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {Math.max(1, Math.ceil(total / 25))} · {total} candidates</span>
          <Button size="sm" variant="secondary" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
        {!candidates ? (
          <Skeleton className="h-64 w-full" />
        ) : candidates.length === 0 ? (
          <EmptyState title="No candidates match these filters" />
        ) : (
          <div className="max-h-96 overflow-auto rounded-lg border border-black/5">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-xs text-black/40">
                <tr className="border-b border-black/5">
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Education signal</th>
                  <th className="px-3 py-2 text-left font-medium">Domain</th>
                  <th className="px-3 py-2 text-right font-medium">V1 score</th>
                  <th className="px-3 py-2 text-left font-medium">Department</th>
                  <th className="px-3 py-2 text-left font-medium">Role hired into</th>
                  <th className="px-3 py-2 text-right font-medium">Tenure (mo)</th>
                  <th className="px-3 py-2 text-right font-medium">Promotions</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
                    <td className="px-3 py-2">
                      <Link href={`/talent/candidates/${c.id}`} className="font-medium text-black/80 hover:underline">{c.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-black/55">
                      {c.eliteUniversity && <Badge tone="neutral" className="mr-1">Elite uni</Badge>}
                      {c.priorLeadership && <Badge tone="neutral" className="mr-1">Leadership</Badge>}
                      {c.startupExperience && <Badge tone="talent">0→1 startup</Badge>}
                    </td>
                    <td className="px-3 py-2 text-black/60">{c.technicalDomain}</td>
                    <td className="px-3 py-2 text-right">{c.originalSourcingScore}</td>
                    <td className="px-3 py-2 text-black/55">{c.performance?.department ?? "—"}</td>
                    <td className="px-3 py-2 text-black/55">{c.performance?.roleHiredInto ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{c.performance?.retentionMonths ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{c.performance?.promotions ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.hire?.hired ? (
                        c.performance?.highPerformer ? <Badge tone="positive">High performer</Badge> : <Badge tone="neutral">Hired</Badge>
                      ) : (
                        <Badge tone="neutral">{c.hire ? "Not hired" : "Decision unknown"}</Badge>
                      )}
                      {c.performance && !c.performance.stillEmployed && <Badge tone="warning" className="ml-1">Left</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

function DetailedCorrelations({ insights }: { insights: Insight[] }) {
  const correlationInsights = insights.filter((i) => i.kind === "CORRELATION");
  if (correlationInsights.length === 0) return null;
  return (
    <details className="mb-8 rounded-xl2 border border-black/5 bg-white shadow-card">
      <summary className="cursor-pointer select-none p-5 text-sm font-medium text-black/70">Supporting evidence — detailed factor correlations</summary>
      <div className="space-y-3 border-t border-black/5 p-5">
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
                <span key={ci} className="rounded bg-black/[0.04] px-1.5 py-0.5">{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function TalentPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = () => {
    fetch("/api/talent/summary").then((r) => r.json()).then(setSummary);
  };

  useEffect(() => {
    load();
  }, []);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/talent/analyze", { method: "POST" });
      load();
    } finally {
      setAnalyzing(false);
    }
  };

  const decideProposal = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const items = await fetch(`/api/approvals?status=PENDING`).then((r) => r.json());
    const match = items.items.find((i: { entityId: string }) => i.entityId === id);
    if (!match) throw new Error("No pending approval exists. Re-run analysis to create a current proposal.");
    await fetch(`/api/approvals/${match.id}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    load();
  };

  const handleUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/talent/csv", { method: "POST", body: form });
    const data = await res.json();
    setUploadMsg(res.ok ? `Imported ${data.created}/${data.totalRows} rows. ${(data.errors ?? []).join("; ")}` : data.error);
    load();
  };

  const pendingPromotion = summary?.weightProposals.find((p) => p.status === "PENDING");

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <ProductHeader
        name="Sourcing Optimizer"
        tagline="An autonomous evaluator for Wonderful's sourcing model: it connects historical candidates to what actually happened after they were hired, audits what the model got wrong, and validates a better one before recommending it."
        accentText="text-talent"
        accentBg="bg-talent-soft"
      />

      {!summary ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <ValidationHero evaluation={summary.evaluation} />

          {pendingPromotion && summary.evaluation?.validationStatus === "PASSED" && (
            <Card className="mb-8 border-amber-200 bg-amber-50/50">
              <SectionHeading eyebrow="Human approval required" title="Promote Model V2 to active?" detail="Nothing changes until you approve. In production this connects to Wonderful's sourcing system through a system connector." />
              <p className="mb-3 text-xs text-black/55">{pendingPromotion.rationale}</p>
              <div className="flex gap-2">
                <Button size="sm" accent="talent" onClick={() => decideProposal(pendingPromotion.id, "APPROVED")}>Approve</Button>
                <Button size="sm" variant="secondary" onClick={() => decideProposal(pendingPromotion.id, "REJECTED")}>Reject</Button>
              </div>
            </Card>
          )}

          {summary.evaluation && summary.evaluation.factorAudit.length > 0 && <FactorAudit factorAudit={summary.evaluation.factorAudit} />}

          {summary.latestRun?.llmSummary && (
            <Card className="mb-8">
              <div className="mb-2 flex items-center justify-between">
                <SectionHeading eyebrow="LLM interpretation" title="What this means" />
                <Badge tone={summary.latestRun.llmProvider === "live" ? "positive" : "neutral"}>
                  {summary.latestRun.llmProvider === "live" ? `Live · ${summary.latestRun.llmModel}` : "Demo interpretation"}
                </Badge>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-black/65">{summary.latestRun.llmSummary}</p>
            </Card>
          )}

          <BatchComparison rows={summary.batchRanking} />

          <DetailedCorrelations insights={summary.insights} />
          <CandidateHistoryTable />

          <Card className="mb-8">
            <SectionHeading
              eyebrow="Ingestion layer"
              title="Connect Wonderful's sourcing and HRIS systems"
              detail="In production this happens automatically through system connectors. CSV import below is a fallback for demo/testing only."
            />
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="text-sm text-black/60 file:mr-3 file:rounded-md file:border-0 file:bg-talent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-talent"
            />
            <p className="mt-2 text-xs text-black/40">Expected columns: {CANDIDATE_CSV_TEMPLATE_HEADERS.join(", ")}</p>
            {uploadMsg && <p className="mt-2 text-xs text-black/50">{uploadMsg}</p>}
          </Card>

          <div className="mb-8 flex items-center justify-between text-xs text-black/40">
            <span>The audit re-evaluates automatically on a weekly schedule as new employee outcomes arrive — no manual step needed in normal operation.</span>
            <Button size="sm" variant="ghost" onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? "Re-evaluating…" : "Force re-evaluation now"}
            </Button>
          </div>
        </>
      )}
      <RunHistory agent="TALENT_INTELLIGENCE" />
    </main>
  );
}
