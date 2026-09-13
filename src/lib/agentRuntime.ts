import { db } from "./db";
import type { AgentKey } from "./types";

// Shared database lease for manual and scheduled entrypoints; recover after a crashed process.
export async function withAgentLease<T>(agentKey: AgentKey, work: () => Promise<T>): Promise<T> {
  await db.scheduledJob.upsert({ where:{agentKey},update:{},create:{agentKey,label:agentKey,cronExpr:agentKey==="COMPANY_SCOUT"?"0 7 * * *":agentKey==="EXTERNAL_RADAR"?"0 */6 * * *":"0 6 * * 1"} });
  const now = new Date(), stale = new Date(now.getTime()-15*60000);
  const claimed = await db.scheduledJob.updateMany({where:{agentKey,OR:[{lastStatus:null},{lastStatus:{not:"RUNNING"}},{lastRunAt:{lt:stale}}]},data:{lastStatus:"RUNNING",lastRunAt:now}});
  if (!claimed.count) throw new Error("Agent already running; wait for the current run to finish");
  try {
    await db.agentRun.updateMany({where:{agent:agentKey,status:"RUNNING",startedAt:{lt:stale}},data:{status:"FAILED",endedAt:now,errorMessage:"Run interrupted: expired lease recovered"}});
    const result = await work();
    await db.scheduledJob.updateMany({where:{agentKey,lastRunAt:now},data:{lastStatus:"SUCCEEDED",lastResult:JSON.stringify(result)}});
    await db.auditLogEntry.create({data:{actor:"agent",action:"run_succeeded",entityType:"ScheduledJob",entityId:agentKey,detailJson:JSON.stringify(result)}});
    return result;
  } catch(err) {
    await db.scheduledJob.updateMany({where:{agentKey,lastRunAt:now},data:{lastStatus:"FAILED",lastResult:err instanceof Error?err.message:String(err)}});
    await db.auditLogEntry.create({data:{actor:"agent",action:"run_failed",entityType:"ScheduledJob",entityId:agentKey,detailJson:JSON.stringify({error:err instanceof Error?err.message:String(err)})}});
    throw err;
  }
}

export async function retry<T>(work:()=>Promise<T>, attempts=3, delayMs=250):Promise<T> {
  for(let attempt=1;;attempt++) {
    try {return await work();} catch(err) {
      if(attempt>=attempts) throw err;
      await new Promise(resolve=>setTimeout(resolve,delayMs*2**(attempt-1)));
    }
  }
}
