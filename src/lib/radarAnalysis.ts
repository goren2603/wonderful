export interface SignalMention { id?:string; text:string; sourceDate:Date; sourceName:string; sourceUrl:string; sentiment:string; audienceLens:string; isDemo:boolean; category:string }
export function classifyTheme(text:string,category:string) {
  if(/competitor|competing|rival|layoff|workforce reduction/i.test(text)) return {label:"Competitor instability",category:"Market signal"};
  if(/voice agent|market trend|industry discussion|category interest|adoption (is|of).*increas/i.test(text)) return {label:"Market topic trend",category:"Market signal"};
  if(/onboard|setup|learning curve|first workflow|integration/i.test(text)) return {label:"Onboarding friction",category:"Product feedback"};
  if(/leadership|exec|head of|enterprise push/i.test(text)) return {label:"Leadership and investment",category:"Leadership / company update"};
  if(/hours|balance|crunch|long weeks|calendar|burning out|recovery|exhaust|culture|late night/i.test(text)) return {label:"Workload and culture",category:"Employer brand"};
  if(/accurac|accurate|quality|impress|renew|praise|support time|sourcing|customer service/i.test(text)) return {label:"Product value and advocacy",category:"Product feedback"};
  return {label:`Other: ${category}`,category};
}
export function weekStart(d:Date) {const out=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));out.setUTCDate(out.getUTCDate()-(out.getUTCDay()+6)%7);return out;}
export function analyzeTheme(label:string,mentions:SignalMention[],now=new Date()) {
  const end=weekStart(now);
  const trend=Array.from({length:8},(_,i)=>({weekStart:new Date(end.getTime()-(7-i)*7*86400000),mentionCount:0}));
  const start=trend[0].weekStart;
  const relevant=mentions.filter(m=>m.sourceDate>=start&&m.sourceDate<=now);
  for(const m of relevant) {const i=Math.floor((weekStart(m.sourceDate).getTime()-start.getTime())/(7*86400000)); if(trend[i]) trend[i].mentionCount++;}
  const recentStart=trend[5].weekStart;
  const recent=relevant.filter(m=>m.sourceDate>=recentStart);
  const earlier=trend.slice(0,5).reduce((s,p)=>s+p.mentionCount,0)/5;
  const recentAvg=recent.length/3;
  const growth=earlier?recentAvg/earlier:null;
  const sources=new Set(recent.map(m=>{try{return new URL(m.sourceUrl).hostname.replace(/^www\./,'');}catch{return m.sourceName;}})).size;
  const negative=recent.filter(m=>m.sentiment==='NEGATIVE').length;
  const positive=recent.filter(m=>m.sentiment==='POSITIVE').length;
  const competitor=label==='Competitor instability';
  const productSignal=label==='Market topic trend';
  const qualifies=recent.length>=3&&sources>=2&&(competitor||productSignal||Math.max(negative,positive)/recent.length>=.6);
  const type:'RISK'|'OPPORTUNITY'|'PRODUCT_SIGNAL'=productSignal?'PRODUCT_SIGNAL':competitor||positive>negative?'OPPORTUNITY':'RISK';
  const severity=recent.length>=10&&growth!==null&&growth>=3?'HIGH':recent.length>=5?'MEDIUM':'LOW';
  // Confidence describes evidence volume/diversity only; synthetic records can never earn high confidence.
  const confidence=recent.some(m=>m.isDemo)?'LOW':recent.length>=10&&sources>=3?'HIGH':recent.length>=5?'MEDIUM':'LOW';
  const baseline=`${earlier.toFixed(2)} mentions/week across 5 earlier calendar weeks (zero weeks included)`;
  const lastWeekCount=trend[7].mentionCount; // this calendar week specifically (partial — still accumulating), distinct from the 3-week qualifying window below
  const executiveCount=recent.filter(m=>m.audienceLens==='EXECUTIVE').length;
  const trendText=`${recent.length} mentions in the latest 3 calendar weeks (current week partial); ${growth===null?'new signal / no prior baseline':growth.toFixed(2)+'x baseline'}`;
  const explanation=`Rule: at least 3 recent mentions, 2 distinct source domains and 60% directional sentiment (or explicit competitor instability / market topic trend). Observed ${recent.length} mentions across ${sources} domains: ${negative} negative, ${positive} positive. ${baseline}. ${trendText}. ${recent.some(m=>m.isDemo)?'Synthetic scenario: not evidence about a real company.':'Independent sources and factual claims still require verification.'}`;
  const action=competitor?'Verify the competitor event and affected customer segment before preparing any outreach.':productSignal?'Assess whether this topic intersects a Wonderful use case; consider it as context for Growth Agent outreach angles.':type==='OPPORTUNITY'?'Validate the positive reports and request permission for a customer proof point.':'Review the cited reports with the accountable team; verify the pattern before acting.';
  // "Better for us" direction differs by type: more RISK mentions is worse; more
  // OPPORTUNITY/PRODUCT_SIGNAL mentions is better. RESOLVED overrides both once
  // the alert no longer meets the qualifying threshold.
  const risingIsGood=type!=='RISK';
  const state:'WORSENING'|'IMPROVING'|'STABLE'|'RESOLVED' = !qualifies?'RESOLVED':growth===null?'STABLE':growth>=1.3?(risingIsGood?'IMPROVING':'WORSENING'):growth<=0.7?(risingIsGood?'WORSENING':'IMPROVING'):'STABLE';
  return {trend,recent,qualifies,type,severity,confidence,evidenceCount:recent.length,baseline,trendText,explanation,action,growth,sources,state,lastWeekCount,executiveCount};
}
