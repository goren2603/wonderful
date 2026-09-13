import { NextRequest, NextResponse } from "next/server";

// Optional shared demo access gate. Put Cloudflare Access in front of the tunnel for real users/data.
const requests=new Map<string,{at:number;count:number}>();
export function middleware(req:NextRequest) {
  const token=process.env.DEMO_ACCESS_TOKEN;
  const isCron=req.nextUrl.pathname==='/api/agents/run'&&req.method==='GET';
  if(token&&!isCron) {
    let password='';try{const value=req.headers.get('authorization')??'';if(value.startsWith('Basic ')) password=atob(value.slice(6)).split(':').slice(1).join(':');}catch{}
    if(password!==token) return new NextResponse('Demo access required',{status:401,headers:{'WWW-Authenticate':'Basic realm="Wonderful demo"'}});
  }
  if(req.nextUrl.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const origin=req.headers.get('origin');
    const host=req.headers.get('x-forwarded-host')??req.headers.get('host');
    if(origin&&new URL(origin).host!==host) return NextResponse.json({error:'Cross-origin mutation rejected'},{status:403});
    if(Number(req.headers.get('content-length')??0)>2_000_000) return NextResponse.json({error:'Request too large'},{status:413});
    const key=req.headers.get('cf-connecting-ip')??req.headers.get('x-forwarded-for')??'local';
    const now=Date.now();
    if(requests.size>1000) for(const [k,v] of requests) if(now-v.at>60000) requests.delete(k);
    const current=requests.get(key);const bucket=current&&now-current.at<60000?current:{at:now,count:0};
    bucket.count++;requests.set(key,bucket);
    if(bucket.count>60) return NextResponse.json({error:'Too many changes; retry in a minute'},{status:429});
  }
  return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
