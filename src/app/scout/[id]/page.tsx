"use client";
import { request as fetch } from "@/lib/client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, DemoBadge, LiveBadge, Button, SectionHeading, ProgressBar, Skeleton, EmptyState } from "@/components/ui/primitives";
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
  email: string | null;
  confidence: number;
  whyThisPerson: string | null;
  isReal: boolean;
}
interface OutreachMessage {
  id: string;
  decisionMakerId: string | null;
  channel: "EMAIL" | "LINKEDIN";
  subject: string | null;
  body: string;
  angle: string;
  status: string;
  sentAt: string | null;
  replyNote: string | null;
  nextAction: string | null;
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
  discoveryMode: "demo" | "live" | "manual";
  decisionMakers: DecisionMaker[];
  outreach: OutreachMessage[];
  scoreHistory: { score: number; recordedAt: string }[];
}

function OutreachCard({ message, onChanged, decisionMakerLinkedinUrl }: { message: OutreachMessage; onChanged: () => void; decisionMakerLinkedinUrl?: string | null }) {
  const [copied, setCopied] = useState(false);
  const [manualConfirmed,setManualConfirmed]=useState(false);
  const [replyNote,setReplyNote]=useState("");
  const [nextAction,setNextAction]=useState("");

  const setStatus = async (status: string, extra?: Record<string, unknown>) => {
    await fetch(`/api/scout/outreach/${message.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, manualConfirmed, ...extra }),
    });
    onChanged();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(message.body); setCopied(true); setTimeout(()=>setCopied(false),1500); }
    catch { window.dispatchEvent(new CustomEvent('app-error',{detail:'Clipboard unavailable. Select and copy the draft text manually.'})); }
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
      throw new Error("No pending approval exists. Refresh this prospect through a scan.");
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
      <p className="mb-2 text-xs italic text-black/40">Angle: {message.angle}</p>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45">
        <span>Last contact: {message.sentAt ? new Date(message.sentAt).toLocaleDateString() : "not yet sent"}</span>
        {message.replyNote && <span>Reply: {message.replyNote}</span>}
        {message.nextAction && <span>Next action: {message.nextAction}</span>}
      </div>
      {(message.status === "SENT" || message.status === "FOLLOW_UP_DUE") && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-black/15 p-2">
          <label className="text-xs">Reply note<input className="ml-2 w-48 border p-1 text-xs" value={replyNote} onChange={(e) => setReplyNote(e.target.value)} placeholder="What did they say?" /></label>
          <label className="text-xs">Next action<input className="ml-2 w-40 border p-1 text-xs" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. send proposal" /></label>
          <Button size="sm" variant="secondary" onClick={() => setStatus("REPLIED", { replyNote, nextAction })}>Record reply</Button>
        </div>
      )}

      {(message.status === "APPROVED" || message.channel === "LINKEDIN") && <label className="mb-2 flex gap-2 text-xs"><input type="checkbox" checked={manualConfirmed} onChange={e=>setManualConfirmed(e.target.checked)} />I actually sent this message outside the app</label>}
      <Button size="sm" variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy draft"}</Button>
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
              <Button size="sm" accent="scout" onClick={() => setStatus("SENT")} disabled={!manualConfirmed}>
                Record external send
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
            {decisionMakerLinkedinUrl ? (
              <a href={decisionMakerLinkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-black/80 hover:bg-black/[0.03]">
                Open LinkedIn →
              </a>
            ) : (
              <span className="rounded-md border border-dashed border-black/20 px-2.5 py-1.5 text-xs text-black/45">
                No LinkedIn profile on file yet — add one via &quot;Add a real target&quot; to enable Open LinkedIn.
              </span>
            )}
            <span className="w-full text-xs text-black/40">Sending is always a manual handoff here — no authorized LinkedIn integration is connected.</span>
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
        ← Growth Agent
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-black/90">{prospect.companyName}</h1>
            {prospect.discoveryMode === "demo" ? <DemoBadge /> : prospect.discoveryMode === "manual" ? <Badge tone="positive">Real target you added</Badge> : <LiveBadge />}
          </div>
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
              <p className="mt-1 text-xs text-black/45">{b.why}</p><div className="text-xs">{b.evidenceIds.map((id,i)=><a key={id} className="mr-2 underline" href={`#evidence-${id}`}>Evidence {i+1}</a>)}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-black/[0.03] p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/40">Why now</p>
          <ul className="space-y-1 text-sm text-black/65">
            {why.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="mb-6">
        <SectionHeading eyebrow="Wonderful use case" title={prospect.useCase ?? "—"} detail={prospect.useCaseRationale ?? undefined} />
      </Card>

      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading eyebrow="Sources" title="Evidence" />
          {evidence.length > 0 && evidence.every((e) => e.isDemo) ? <DemoBadge /> : evidence.length > 0 && evidence.every((e) => !e.isDemo) ? <LiveBadge /> : evidence.length > 0 ? <span className="text-[10px] font-medium text-black/40">Mixed live/demo</span> : null}
        </div>
        {evidence.length === 0 ? (
          <EmptyState title="No evidence recorded" />
        ) : (
          <div className="space-y-2">
            {evidence.map((e) => (
              <div id={`evidence-${e.id}`} key={e.id} className="rounded-lg border border-black/5 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-black/75 hover:underline">
                    {e.sourceName}
                  </a>
                  <span className="text-xs text-black/40">{e.isDemo ? "Synthetic — unverified" : `${Math.round(e.confidence * 100)}% confidence`}</span>
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
        <SectionHeading eyebrow="Target people" title="Decision makers & outreach" detail="Email stays approval-gated by default. LinkedIn is always a manual handoff." />
        <div className="space-y-5">
          {prospect.decisionMakers.map((dm) => {
            const messages = prospect.outreach.filter((m) => m.decisionMakerId === dm.id);
            const orphaned = dm === prospect.decisionMakers[0] ? prospect.outreach.filter((m) => !m.decisionMakerId) : [];
            return (
              <div key={dm.id} className="rounded-lg border border-black/10 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-black/80">
                    {dm.isReal ? dm.name : dm.title} {dm.isReal && <Badge tone="positive" className="ml-1">Real target</Badge>}
                  </p>
                  <span className="text-xs text-black/40">{dm.isReal ? `${Math.round(dm.confidence * 100)}% confidence` : "Role hypothesis, not a verified contact"}</span>
                </div>
                {dm.isReal && (
                  <p className="mb-1 text-xs text-black/50">
                    {dm.title}
                    {dm.email ? ` · ${dm.email}` : ""}
                    {dm.linkedinUrl ? (
                      <>
                        {" · "}
                        <a href={dm.linkedinUrl} target="_blank" rel="noreferrer" className="underline">
                          {dm.linkedinUrl}
                        </a>
                      </>
                    ) : (
                      ""
                    )}
                  </p>
                )}
                {dm.whyThisPerson && <p className="mb-3 text-xs italic text-black/45">Why this person: {dm.whyThisPerson}</p>}
                <div className="space-y-3">
                  {[...messages, ...orphaned].map((m) => (
                    <OutreachCard key={m.id} message={m} onChanged={load} decisionMakerLinkedinUrl={dm.linkedinUrl} />
                  ))}
                  {messages.length === 0 && orphaned.length === 0 && <EmptyState title="No outreach drafted for this person yet" />}
                </div>
              </div>
            );
          })}
          {prospect.decisionMakers.length === 0 && (
            <div className="space-y-3">
              {prospect.outreach.map((m) => (
                <OutreachCard key={m.id} message={m} onChanged={load} />
              ))}
              {prospect.outreach.length === 0 && (
                <EmptyState title="No verified contact found" detail="Checked Wikidata for a real CEO/director claim for this company — none exists there, so no name was guessed and no outreach draft was created. If you know a real contact here, add them as a real target from the Growth Agent page." />
              )}
            </div>
          )}
        </div>
      </Card>

      {prospect.status === "REPLIED" && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/40">
          <SectionHeading eyebrow="Reply received" title="Book a meeting?" detail="Marks the deal at the final pipeline stage." />
          <Button
            size="sm"
            accent="scout"
            onClick={async () => {
              await fetch(`/api/scout/prospects/${params.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "MEETING_BOOKED" }) });
              load();
            }}
          >
            Mark meeting booked
          </Button>
        </Card>
      )}
      {prospect.status === "MEETING_BOOKED" && (
        <Card className="mb-6 border-emerald-300 bg-emerald-50">
          <Badge tone="positive">Meeting booked</Badge>
        </Card>
      )}

      <Card>
        <SectionHeading title="Score history" detail="Each evaluation preserves its score; unchanged inputs should give unchanged scores." />
        {prospect.scoreHistory.map((h, i) => (
          <p key={i} className="text-sm">{new Date(h.recordedAt).toLocaleString()} — {h.score}/100</p>
        ))}
      </Card>
    </main>
  );
}
