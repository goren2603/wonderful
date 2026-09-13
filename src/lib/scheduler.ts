import { Cron } from 'croner';
import { db } from '@/lib/db';
import { runTalentAnalysis } from '@/lib/agents/talentAgent';
import { runCompanyScoutScan } from '@/lib/agents/scoutAgent';
import { runRadarScan } from '@/lib/agents/radarAgent';
import { COUNTRIES, VERTICALS } from '@/lib/seedData/prospects';
import { AGENT_KEYS, type AgentKey } from '@/lib/types';
export const DEFAULT_JOBS:{agentKey:AgentKey;label:string;cronExpr:string}[]=[
  {agentKey:'COMPANY_SCOUT',label:'Daily market scan',cronExpr:'0 7 * * *'},
  {agentKey:'EXTERNAL_RADAR',label:'Signal monitoring',cronExpr:'0 */6 * * *'},
  {agentKey:'TALENT_INTELLIGENCE',label:'Weekly sourcing analysis',cronExpr:'0 6 * * 1'},
];
export async function triggerAgentRun(agentKey:AgentKey) {
  if(!AGENT_KEYS.includes(agentKey)) throw new Error('Invalid agentKey');
  if(agentKey==='TALENT_INTELLIGENCE') return runTalentAnalysis();
  if(agentKey==='COMPANY_SCOUT') return runCompanyScoutScan({countries:COUNTRIES,verticals:VERTICALS,limit:8});
  return runRadarScan();
}
const state=globalThis as unknown as {schedulerStarting?:Promise<void>;schedulerTimer?:ReturnType<typeof setInterval>};
// Poll persisted due dates, including missed runs after restart. No browser required.
export async function schedulerTick(now=new Date()) {
  const jobs=await db.scheduledJob.findMany({where:{enabled:true,nextRunAt:{lte:now}}});
  for(const job of jobs) {
    if(!AGENT_KEYS.includes(job.agentKey as AgentKey)) continue;
    const cron=new Cron(job.cronExpr,{paused:true,timezone:'UTC'});
    const next=cron.nextRun()!;cron.stop();
    // Atomic claim prevents duplicate dispatch across workers. Run-level leases protect manual overlap.
    const claim=await db.scheduledJob.updateMany({where:{id:job.id,nextRunAt:job.nextRunAt},data:{nextRunAt:next}});
    if(!claim.count) continue;
    try {await triggerAgentRun(job.agentKey as AgentKey);}
    catch(err) {
      // Persist bounded retries; survive restart and expose retry state in nextRunAt/lastResult.
      let previous:{attempt?:number}={};try{previous=JSON.parse(job.lastResult??'{}');}catch{}
      const attempt=(previous.attempt??0)+1;
      const error=err instanceof Error?err.message:String(err);
      await db.scheduledJob.updateMany({where:{id:job.id,lastStatus:{not:'RUNNING'}},data:{lastStatus:'FAILED',lastResult:JSON.stringify({attempt,error,retry:attempt<3}),nextRunAt:attempt<3?new Date(now.getTime()+60000*2**(attempt-1)):next}});
    }
  }
}
export async function startScheduler() {
  if(process.env.DISABLE_SCHEDULER==='1'||process.env.VERCEL||process.env.NEXT_PHASE==='phase-production-build') return;
  if(state.schedulerStarting) return state.schedulerStarting;
  state.schedulerStarting=(async()=>{
    for(const def of DEFAULT_JOBS) {
      const cron=new Cron(def.cronExpr,{paused:true,timezone:'UTC'});const next=cron.nextRun();cron.stop();
      await db.scheduledJob.upsert({where:{agentKey:def.agentKey},update:{},create:{...def,nextRunAt:next}});
      await db.scheduledJob.updateMany({where:{agentKey:def.agentKey,nextRunAt:null,enabled:true},data:{nextRunAt:next}});
    }
    const tick=()=>schedulerTick().catch(err=>console.error('Scheduler tick failed',err));
    await tick();
    state.schedulerTimer=setInterval(tick,15000);state.schedulerTimer.unref();
  })().catch(err=>{state.schedulerStarting=undefined;throw err;});
  return state.schedulerStarting;
}
