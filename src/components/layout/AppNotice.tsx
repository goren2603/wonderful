"use client";
import { useEffect,useState } from "react";
// Browser wallet extensions (MetaMask, Coinbase Wallet, Phantom, ...) inject
// scripts into every page and throw their own unhandled rejections when they
// can't connect — nothing to do with this app. A generic window-level
// listener catches those too; without filtering them out, a visitor with
// one of those extensions installed sees "Failed to connect to MetaMask" on
// a recruiting/growth product, which reads as a real app error.
const EXTENSION_NOISE=/metamask|ethereum|web3|wallet|coinbase|phantom|trustwallet/i;
export function AppNotice() {
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{const handle=(event:Event)=>setError((event as CustomEvent).detail);const rejected=(event:PromiseRejectionEvent)=>{const message=event.reason?.message??'Request failed';if(EXTENSION_NOISE.test(message))return;setError(message);event.preventDefault();};window.addEventListener('app-error',handle);window.addEventListener('unhandledrejection',rejected);return()=>{window.removeEventListener('app-error',handle);window.removeEventListener('unhandledrejection',rejected);};},[]);
  return <><div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-xs text-amber-900">Demo workspace · Sourcing Optimizer uses synthetic seed data · Growth Agent's default scan is real live discovery (Wikipedia, Hacker News, Wikidata) — its "Load sample scenario" button is the one place with canned research · Radar checks every tracked company (including Wonderful) against those same real sources every scan · No emails sent automatically by this app — subscribe on the Radar page to get real ones when mentions spike</div>{error&&<div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-rose-100 p-3 text-sm text-rose-900"><span>{error}</span><button onClick={()=>setError(null)}>Dismiss</button><button onClick={()=>window.location.reload()}>Reload</button></div>}</>;
}
