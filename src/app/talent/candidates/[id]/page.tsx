"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, SectionHeading, Skeleton } from "@/components/ui/primitives";
import type { WeightReason } from "@/lib/types";

interface CandidateDetail {
  id: string;
  name: string;
  currentTitle: string;
  yearsExperience: number;
  education: string;
  previousCompaniesJson: string;
  startupExperience: boolean;
  technicalDomain: string;
  geography: string;
  originalSourcingScore: number;
  hire: { hired: boolean; rejectionReason: string | null } | null;
  performance: { retentionMonths: number | null; managerRating: number | null; promotionVelocityMonths: number | null } | null;
  interviews: { stage: string; outcome: string; interviewedAt: string }[];
  rankings: { oldRank: number; newRank: number; oldScore: number; newScore: number; reasonJson: string }[];
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);

  useEffect(() => {
    fetch(`/api/talent/candidates/${params.id}`)
      .then((r) => r.json())
      .then((d) => setCandidate(d.candidate));
  }, [params.id]);

  if (!candidate) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  const previousCompanies: string[] = JSON.parse(candidate.previousCompaniesJson);
  const ranking = candidate.rankings[0];
  const reasons: WeightReason[] = ranking ? JSON.parse(ranking.reasonJson) : [];
  const delta = ranking ? ranking.oldRank - ranking.newRank : 0;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link href="/talent" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-black/40 hover:text-black/70">
        ← Talent Intelligence
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black/90">{candidate.name}</h1>
          <p className="text-sm text-black/50">
            {candidate.currentTitle} · {candidate.geography} · {candidate.yearsExperience} yrs experience
          </p>
        </div>
        {candidate.hire?.hired ? <Badge tone="positive">Hired</Badge> : <Badge tone="neutral">Not hired</Badge>}
      </div>

      {ranking && (
        <Card className="mb-6">
          <SectionHeading eyebrow="Why did the ranking change?" title={`Rank #${ranking.oldRank} → #${ranking.newRank}`} />
          <p className="mb-3 text-sm text-black/60">
            Original sourcing score: <strong>{ranking.oldScore}</strong> → Learned score: <strong>{ranking.newScore}</strong>{" "}
            <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-black/40"}>
              {delta > 0 ? `(moved up ${delta})` : delta < 0 ? `(moved down ${Math.abs(delta)})` : "(no change)"}
            </span>
          </p>
          <div className="space-y-2">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2 text-sm">
                <span className="text-black/70">{r.detail}</span>
                <span className={`font-medium ${r.contribution >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.contribution >= 0 ? "+" : ""}
                  {r.contribution.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <SectionHeading title="Profile" />
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-black/45">Education</dt>
              <dd>{candidate.education}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/45">Domain</dt>
              <dd>{candidate.technicalDomain}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/45">Startup experience</dt>
              <dd>{candidate.startupExperience ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/45">Original sourcing score</dt>
              <dd>{candidate.originalSourcingScore}</dd>
            </div>
            <div>
              <dt className="mb-1 text-black/45">Previous companies</dt>
              <dd className="flex flex-wrap gap-1">
                {previousCompanies.map((c, i) => (
                  <Badge key={i} tone="neutral">
                    {c}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <SectionHeading title="Outcomes" />
          <dl className="space-y-1.5 text-sm">
            {candidate.interviews.map((iv, i) => (
              <div key={i} className="flex justify-between">
                <dt className="text-black/45">Interview ({iv.stage})</dt>
                <dd>{iv.outcome}</dd>
              </div>
            ))}
            {candidate.hire && (
              <div className="flex justify-between">
                <dt className="text-black/45">Hire decision</dt>
                <dd>{candidate.hire.hired ? "Hired" : candidate.hire.rejectionReason ?? "Not hired"}</dd>
              </div>
            )}
            {candidate.performance && (
              <>
                <div className="flex justify-between">
                  <dt className="text-black/45">Retention</dt>
                  <dd>{candidate.performance.retentionMonths ?? "—"} months</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Manager rating</dt>
                  <dd>{candidate.performance.managerRating ?? "—"} / 5</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Promotion velocity</dt>
                  <dd>{candidate.performance.promotionVelocityMonths ?? "No promotion yet"}</dd>
                </div>
              </>
            )}
          </dl>
        </Card>
      </div>
    </main>
  );
}
