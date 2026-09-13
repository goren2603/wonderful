"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, DemoBadge, Button, SectionHeading, ProgressBar, Skeleton, EmptyState } from "@/components/ui/primitives";
import type { ScoreComponent } from "@/lib/types";

interface Evidence {
  id: string;
  sourceUrl: string;
  sourceName: string;
  sourceDate: string;
  title: string;
  snippet: string;
  confidence: number;
  isDemo: boolean;
}
interface DecisionMaker {
  id: string;
  name: string;
  title: string;
  linkedinUrl: string | null;
  confidence: number;
}
interface OutreachMessage {
  id: string;
  channel: "EMAIL" | "LINKEDIN";
  subject: string | null;
  body: string;
  angle: string;
  status: string;
}
interface Prospect {
  id: string;
  companyName: string;
  country: string;
  vertical: string;
  website: string | null;
  employeeCountEstimate: string | null;
  opportunityScore: number;
  scoreBreakdownJson: string;
  useCase: string | null;
  useCaseRationale: string | null;
  status: string;
  whyJson: string;
  decisionMakers: DecisionMaker[];
  outreach: OutreachMessage[];
  scoreHistory: { score: number; recordedAt: string }[];
}

function OutreachCard({ message, onChanged }: { message: OutreachMessage; onChanged: () => void }) {
  const [copied, setCopied] = useState(false);

  const setStatus = async (status: string) => {
    await fetch(`/api/scout/outreach/${message.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChanged();
  };

  const copy = () => {
    navigator.clipboard?.writeText(message.body).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    const items = await fetch(`/api/approvals?status=PENDING`).then((r) => r.json());
    const match = items.items.find((i: { entityId: string; kind: string }) => i.entityId === message.id && i.kind === "OUTREACH_EMAIL");
    if (match) {
      await fetch(`/api/approvals/${match.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } else {
      // Approval item may not exist (e.g. message moved to AWAITING_APPROVAL
      // without going through the standard flow) — fall back to a direct
      // status update so the human-in-the-loop gate is never a dead end.
      await setStatus(decision === "APPROVED" ? "APPROVED" : "DRAFT");
    }
    onChanged();
  };

  return (
    <div className="rounded-lg border border-black/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <Badge tone={message.channel === "EMAIL" ? "scout" : "neutral"}>{message.channel}</Badge>
        <Badge tone={message.status === "SENT" ? "positive" : message.status === "AWAITING_APPROVAL" ? "warning" : "neutral"}>
          {message.status.replace(/_/g, " ").toLowerCase()}
        </Badge>
      </div>
      {message.subject && <p className="mb-1 text-sm font-medium text-black/80">{message.subject}</p>}
      <pre className="mb-3 whitespace-pre-wrap rounded-md bg-black/[0.03] p-3 text-xs leading-relaxed text-black/70">{message.body}</pre>
      <p className="mb-3 text-xs italic text-black/40">Angle: {message.angle}</p>

      <div className="flex flex-wrap gap-2">
        {message.channel === "EMAIL" ? (
          <>
            {message.status === "DRAFT" && (
              <Button size="sm" accent="scout" onClick={() => setStatus("AWAITING_APPROVAL")}>
                Submit for approval
              </Button>
            )}
            {message.status === "AWAITING_APPROVAL" && (
              <>
                <Button size="sm" accent="scout" onClick={() => decide("APPROVED")}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => decide("REJECTED")}>
                  Reject
                </Button>
              </>
            )}
            {message.status === "APPROVED" && (
              <Button size="sm" accent="scout" onClick={() => setStatus("SENT")}>
                Mark as sent (connect an email provider to send automatically)
              </Button>
            )}
            {message.status === "SENT" && (
              <Button size="sm" variant="secondary" onClick={() => setStatus("FOLLOW_UP_DUE")}>
                Mark follow-up due
              </Button>
            )}
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? "Copied!" : "Copy message"}
            </Button>
            <span className="rounded-md border border-dashed border-black/20 px-2.5 py-1.5 text-xs text-black/45">
              Open LinkedIn — requires live profile research (demo mode). Authorized LinkedIn integration would be required for automatic sending; this is always a manual handoff.
            </span>
            {message.status !== "SENT" && (
              <Button size="sm" variant="ghost" onClick={() => setStatus("SENT")}>
                Mark as manually sent
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  const load = () =>
    fetch(`/api/scout/prospects/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setProspect(d.prospect);
        setEvidence(d.evidence);
      });

  useEffect(() => {
    load();
  }, [params.id]);

  const feedback = async (vote: "UP" | "DOWN") => {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType: "PROSPECT", targetId: params.id, vote }),
    });
  };

  if (!prospect) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  const breakdown: ScoreComponent[] = JSON.parse(prospect.scoreBreakdownJson);
  const why: string[] = JSON.parse(prospect.whyJson);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <Link href="/scout" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-black/40 hover:text-black/70">
        ← Company Scout
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black/90">{prospect.companyName}</h1>
          <p className="text-sm text-black/50">
            {prospect.country} · {prospect.vertical} · {prospect.employeeCountEstimate} employees
            {prospect.website && (
              <>
                {" · "}
                <a href={prospect.website} target="_blank" rel="noreferrer" className="underline">
                  {prospect.website.replace("https://", "")}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-semibold text-scout">{Math.round(prospect.opportunityScore)}</p>
            <p className="text-xs text-black/40">Opportunity score</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => feedback("UP")} className="rounded-md border border-black/10 px-2 py-1.5 text-sm hover:bg-black/5" title="Relevant prospect">
              👍
            </button>
            <button onClick={() => feedback("DOWN")} className="rounded-md border border-black/10 px-2 py-1.5 text-sm hover:bg-black/5" title="Not relevant">
              👎
            </button>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <SectionHeading eyebrow="Why this prospect" title="Explainable score breakdown" />
        <div className="mb-4 space-y-3">
          {breakdown.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-black/75">{b.label}</span>
                <span className="text-black/50">
                  {b.score}/{b.max}
                </span>
              </div>
              <ProgressBar value={b.score} max={b.max} colorClass="bg-scout" />
              <p className="mt-1 text-xs text-black/45">{b.why}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-black/[0.03] p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/40">Why this prospect, in short</p>
          <ul className="space-y-1 text-sm text-black/65">
            {why.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow="Recommended fit" title={prospect.useCase ?? "—"} detail={prospect.useCaseRationale ?? undefined} />
      </Card>

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading eyebrow="Sources" title="Evidence" />
          <DemoBadge />
        </div>
        {evidence.length === 0 ? (
          <EmptyState title="No evidence recorded" />
        ) : (
          <div className="space-y-2">
            {evidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-black/5 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-black/75 hover:underline">
                    {e.sourceName}
                  </a>
                  <span className="text-xs text-black/40">{Math.round(e.confidence * 100)}% confidence</span>
                </div>
                <p className="mt-1 text-black/55">{e.snippet}</p>
                <p className="mt-1 text-xs text-black/35">
                  Fetched {new Date(e.sourceDate).toLocaleDateString()} · {e.isDemo ? "Demo signal, illustrative" : "Live"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow="Likely buyers" title="Decision makers" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {prospect.decisionMakers.map((dm) => (
            <div key={dm.id} className="rounded-lg border border-black/5 p-3 text-sm">
              <p className="font-medium text-black/75">{dm.title}</p>
              <p className="text-xs text-black/40">{dm.name} · {Math.round(dm.confidence * 100)}% confidence this role is the right buyer</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading eyebrow="Outreach workflow" title="Drafted outreach" detail="Email stays approval-gated by default. LinkedIn is always a manual handoff." />
        <div className="space-y-3">
          {prospect.outreach.map((m) => (
            <OutreachCard key={m.id} message={m} onChanged={load} />
          ))}
        </div>
      </Card>
    </main>
  );
}
