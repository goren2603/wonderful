"use client";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, Button, SectionHeading, Skeleton } from "@/components/ui/primitives";
import type { WeightReason } from "@/lib/types";

interface CandidateDetail {
  id: string;
  name: string;
  currentTitle: string;
  yearsExperience: number;
  education: string;
  previousCompaniesJson: string;
  startupExperience: boolean;
  eliteUniversity: boolean;
  priorLeadership: boolean;
  technicalDomain: string;
  geography: string;
  originalSourcingScore: number;
  isNewBatch: boolean;
  hire: { hired: boolean; rejectionReason: string | null } | null;
  performance: {
    retentionMonths: number | null;
    managerRating: number | null;
    promotionVelocityMonths: number | null;
    stillEmployed: boolean;
    department: string | null;
    roleHiredInto: string | null;
    currentRole: string | null;
    promotions: number;
    highPerformer: boolean;
  } | null;
  interviews: { stage: string; outcome: string; interviewedAt: string }[];
  rankings: { oldRank: number; newRank: number; oldScore: number; newScore: number; reasonJson: string }[];
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [retention,setRetention]=useState(0), [rating,setRating]=useState(3), [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(() => {
    fetch(`/api/talent/candidates/${params.id}`)
      .then((r) => r.json())
      .then((d) => {setCandidate(d.candidate);setRetention(d.candidate.performance?.retentionMonths??0);setRating(d.candidate.performance?.managerRating??3);});
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
        ← Sourcing Optimizer
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black/90">{candidate.name}</h1>
          <p className="text-sm text-black/50">
            {candidate.currentTitle} · {candidate.geography} · {candidate.yearsExperience} yrs experience
          </p>
        </div>
        {candidate.isNewBatch ? (
          <Badge tone="talent">New batch — not yet decided</Badge>
        ) : candidate.hire?.hired ? (
          <Badge tone="positive">Hired</Badge>
        ) : (
          <Badge tone="neutral">Not hired</Badge>
        )}
      </div>

      {ranking && (
        <Card className="mb-6">
          <SectionHeading eyebrow="Why did Model V2 rank this person differently?" title={`Model V1 rank #${ranking.oldRank} → Model V2 rank #${ranking.newRank}`} />
          <p className="mb-3 text-sm text-black/60">
            Model V1 score: <strong>{ranking.oldScore}</strong> → Model V2 score: <strong>{ranking.newScore}</strong>{" "}
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

      {candidate.hire?.hired && <Card className="mb-6"><SectionHeading title="Record a changed outcome" detail="Save real input to the learning loop, then rerun analysis. The approved model remains unchanged until the new version is approved." /><div className="flex flex-wrap gap-3"><label className="text-sm">Retention months<input aria-label="Retention months" className="ml-2 w-20 border p-1" type="number" min="0" max="600" value={retention} onChange={e=>setRetention(Number(e.target.value))} /></label><label className="text-sm">Manager rating<input aria-label="Manager rating" className="ml-2 w-20 border p-1" type="number" min="1" max="5" step="0.1" value={rating} onChange={e=>setRating(Number(e.target.value))} /></label><Button disabled={saving} onClick={async()=>{setSaving(true);try{await fetch(`/api/talent/candidates/${params.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({retentionMonths:retention,managerRating:rating})});setMessage("Outcome saved. Recomputing model…");await fetch("/api/talent/analyze",{method:"POST"});setMessage("New analysis saved. Return to Sourcing Optimizer to see the updated validation.");const d=await fetch(`/api/talent/candidates/${params.id}`).then(r=>r.json());setCandidate(d.candidate);}finally{setSaving(false);}}}>{saving?"Saving…":"Save outcome & reanalyze"}</Button></div><p role="status" className="mt-2 text-sm">{message}</p></Card>}
      {candidate.rankings.length>1&&<Card className="mb-6"><SectionHeading title="Ranking history" detail="Most recent first; each row is a saved proposed model evaluation." />{candidate.rankings.slice(0,10).map((r,i)=><p key={i} className="text-sm">Version {candidate.rankings.length-i}: original #{r.oldRank} → proposed #{r.newRank}</p>)}</Card>}
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
              <dt className="text-black/45">0→1 startup experience</dt>
              <dd>{candidate.startupExperience ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/45">Elite university background</dt>
              <dd>{candidate.eliteUniversity ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/45">Prior leadership experience</dt>
              <dd>{candidate.priorLeadership ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-black/45">Model V1 score</dt>
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
                  <dt className="text-black/45">Department</dt>
                  <dd>{candidate.performance.department ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Role hired into</dt>
                  <dd>{candidate.performance.roleHiredInto ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Current role</dt>
                  <dd>{candidate.performance.currentRole ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Still employed</dt>
                  <dd>{candidate.performance.stillEmployed ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Tenure</dt>
                  <dd>{candidate.performance.retentionMonths ?? "—"} months</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Manager rating</dt>
                  <dd>{candidate.performance.managerRating ?? "—"} / 5</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">Promotions</dt>
                  <dd>{candidate.performance.promotions}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-black/45">High performer</dt>
                  <dd>{candidate.performance.highPerformer ? <Badge tone="positive">Yes</Badge> : <Badge tone="neutral">No</Badge>}</dd>
                </div>
              </>
            )}
          </dl>
        </Card>
      </div>
    </main>
  );
}
