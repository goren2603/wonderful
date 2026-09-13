import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {parseCsv} from '@/lib/csv';
import {createHash} from 'node:crypto';
export async function POST(req:Request) {
  const form=await req.formData().catch(()=>null);const file=form?.get('file');
  if(!file||typeof file==='string') return NextResponse.json({error:'CSV file required'},{status:400});
  if(file.size>1_000_000) return NextResponse.json({error:'CSV limit is 1 MB'},{status:413});
  const text=await file.text();
  let rows:Record<string,string>[];
  try {rows=parseCsv(text);}catch(err){return NextResponse.json({error:err instanceof Error?err.message:'Invalid CSV'},{status:400});}
  if(!rows.length||rows.length>1000) return NextResponse.json({error:'CSV must contain 1–1000 rows'},{status:400});
  const digest=createHash('sha256').update(text).digest('hex');
  if(await db.auditLogEntry.findFirst({where:{action:'csv_import_complete',entityId:digest}})) return NextResponse.json({created:0,updated:0,totalRows:rows.length,errors:['This exact file was already imported.'],alreadyImported:true});
  let created=0,updated=0;const errors:string[]=[];
  const numeric=(value:string|undefined,label:string,min:number,max:number,optional=false)=>{if(!value&&optional)return null;const n=Number(value);if(!value||!Number.isFinite(n)||n<min||n>max)throw new Error(`${label} must be ${min}–${max}`);return n;};
  const bool=(value:string)=>{if(!['true','false','1','0','yes','no','y','n'].includes(value.toLowerCase()))throw new Error('Boolean fields must be true/false, yes/no or 1/0');return ['true','1','yes','y'].includes(value.toLowerCase());};
  for(const [i,row] of rows.entries()) try {
    if(!row.name||row.name.length>200)throw new Error('Name required (max 200 characters)');
    const score=numeric(row.originalSourcingScore,'Score',0,100)!;
    const experience=numeric(row.yearsExperience||'0','Experience',0,80)!;
    const retention=numeric(row.retentionMonths,'Retention',0,600,true);
    const rating=numeric(row.managerRating,'Manager rating',1,5,true);
    const promotion=numeric(row.promotionVelocityMonths,'Promotion months',0,600,true);
    const hired=row.hired?bool(row.hired):null;
    if((retention!==null||rating!==null)&&hired!==true)throw new Error('Performance outcomes require hired=true');
    if(row.interviewOutcome&&!['PASSED','FAILED','WITHDRAWN'].includes(row.interviewOutcome.toUpperCase()))throw new Error('Invalid interview outcome');
    const data={name:row.name,currentTitle:row.currentTitle||'Unknown',yearsExperience:experience,education:row.education||'Unknown',previousCompaniesJson:JSON.stringify((row.previousCompanies||'').split(';').filter(Boolean)),startupExperience:bool(row.startupExperience||'false'),technicalDomain:row.technicalDomain||'Unknown',geography:row.geography||'Unknown',originalSourcingScore:score};
    await db.$transaction(async tx=>{
      // Row fingerprints allow safe retry of a partially invalid import, without duplicating successful rows.
      const rowKey=createHash('sha256').update(JSON.stringify(row)).digest('hex');
      if(await tx.auditLogEntry.findFirst({where:{action:'csv_row_imported',entityId:rowKey}}))return;
      const c=row.candidateId?await tx.candidate.update({where:{id:row.candidateId},data}):await tx.candidate.create({data});
      if(row.interviewOutcome)await tx.interviewOutcome.create({data:{candidateId:c.id,stage:'Imported',outcome:row.interviewOutcome.toUpperCase(),interviewedAt:new Date()}});
      if(hired!==null)await tx.hireOutcome.upsert({where:{candidateId:c.id},update:{hired},create:{candidateId:c.id,hired}});
      if(retention!==null||rating!==null)await tx.performanceRecord.upsert({where:{candidateId:c.id},update:{retentionMonths:retention,managerRating:rating,promotionVelocityMonths:promotion,recordedAt:new Date()},create:{candidateId:c.id,retentionMonths:retention,managerRating:rating,promotionVelocityMonths:promotion}});
      await tx.auditLogEntry.create({data:{actor:'human',action:'csv_row_imported',entityType:'Candidate',entityId:rowKey,detailJson:JSON.stringify({candidateId:c.id})}});
      if(row.candidateId)updated++;else created++;
    });
  } catch(err){errors.push(`Row ${i+2}: ${err instanceof Error?err.message:'Import failed'}`);}
  await db.auditLogEntry.create({data:{actor:'human',action:errors.length?'csv_import_partial':'csv_import_complete',entityType:'Candidate',entityId:digest,detailJson:JSON.stringify({created,updated,errors})}});
  return NextResponse.json({created,updated,errors,totalRows:rows.length});
}
