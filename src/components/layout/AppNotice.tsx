"use client";
import { useEffect,useState } from "react";
export function AppNotice() {
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{const handle=(event:Event)=>setError((event as CustomEvent).detail);const rejected=(event:PromiseRejectionEvent)=>{setError(event.reason?.message??'Request failed');event.preventDefault();};window.addEventListener('app-error',handle);window.addEventListener('unhandledrejection',rejected);return()=>{window.removeEventListener('app-error',handle);window.removeEventListener('unhandledrejection',rejected);};},[]);
  return <><div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-xs text-amber-900">Demo workspace · Sourcing Optimizer uses synthetic seed data · Growth Agent's directory scan uses sample research, but adding a real target fetches real live evidence (Wikipedia, Hacker News) · One Radar source ("AI Agent Market") is real live data, the rest is sample scenario · No emails sent by this app, sending is always a manual handoff</div>{error&&<div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-rose-100 p-3 text-sm text-rose-900"><span>{error}</span><button onClick={()=>setError(null)}>Dismiss</button><button onClick={()=>window.location.reload()}>Reload</button></div>}</>;
}
