"use client";
import {useEffect,useState} from 'react';
import {request} from '@/lib/client';
import {Card,Badge} from '@/components/ui/primitives';
export function RunHistory({agent}:{agent:string}) {
  const [runs,setRuns]=useState<{id:string;status:string;summary:string;startedAt:string;errorMessage:string;stepsJson:string;warningsJson:string}[]>([]);
  const [next,setNext]=useState<string|null>(null);
  useEffect(()=>{let active=true;const load=async()=>{try{const [r,s]=await Promise.all([request(`/api/agents/runs?agent=${agent}&limit=8`).then(r=>r.json()),request('/api/agents/status').then(r=>r.json())]);if(active){setRuns(r.runs);setNext(s.agents.find((a:{agent:string})=>a.agent===agent)?.job?.nextRunAt??null);}}catch{}};load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer);};},[agent]);
  return <Card className="my-6"><h2 className="font-semibold">Agent activity &amp; audit trail</h2><p className="mb-3 text-xs text-black/50">Next scheduled run: {next?new Date(next).toLocaleString():'Not scheduled'} · Schedules use UTC; displayed in your local time.</p>{runs.map(r=><details key={r.id} className="border-t py-3"><summary className="cursor-pointer text-sm"><Badge tone={r.status==='FAILED'?'negative':'neutral'}>{r.status}</Badge> {r.summary??'Run in progress'} · {new Date(r.startedAt).toLocaleString()}</summary>{r.errorMessage&&<p className="text-rose-700">{r.errorMessage}</p>}<ol className="mt-2 space-y-2 text-xs">{JSON.parse(r.stepsJson).map((s:{label:string;detail:string;at:string},i:number)=><li key={i}><strong>{s.label}</strong> — {s.detail}</li>)}</ol>{JSON.parse(r.warningsJson).map((w:string,i:number)=><p key={i} className="mt-2 text-xs text-amber-800">{w}</p>)}<a className="mt-2 block text-xs underline" href={`/api/agents/runs/${r.id}`} target="_blank" rel="noreferrer">Inspect persisted run JSON</a></details>)}</Card>;
}
