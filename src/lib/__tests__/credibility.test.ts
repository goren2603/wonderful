import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learnModel,type CandidateRow} from '../talentModel';
import {approxPValue,correlationInterval,pearsonCorrelation} from '../stats';
import {scoreCompany,dedupeCompany} from '../scoutScoring';
import {SEED_COMPANIES} from '../seedData/prospects';
import {analyzeTheme,classifyTheme} from '../radarAnalysis';

test('correlation tail depends on sample size; known t distribution reference',()=>{
  assert.ok(Math.abs(approxPValue(.5,10)-.14111328125)<.0001);
  assert.ok(approxPValue(.5,100)<approxPValue(.5,10));
  assert.equal(approxPValue(0,10),1);
  assert.ok(correlationInterval(.1,20)![0]<0);
  assert.throws(()=>pearsonCorrelation([1,2],[1]));
});
const candidates:CandidateRow[]=Array.from({length:60},(_,i)=>({id:String(i),yearsExperience:i%10,startupExperience:i%2===0,eliteUniversity:i%4===0,priorLeadership:i%5===0,technicalDomain:i%3===0?'Backend':'Frontend',originalSourcingScore:i,hired:true,retentionMonths:i%2===0?30:5,managerRating:i%2===0?5:1,highPerformer:i%2===0}));
test('learning responds to outcomes and reverses the startup coefficient and candidate order',()=>{
  const initial=learnModel(candidates);
  const changed=learnModel(candidates.map(c=>({...c,retentionMonths:35-c.retentionMonths!,managerRating:6-c.managerRating!})));
  assert.ok(initial.weights.startupExperience>0);
  assert.ok(changed.weights.startupExperience<0);
  assert.ok(initial.scores[0]>initial.scores[1]);
  assert.ok(changed.scores[0]<changed.scores[1]);
});
test('missing outcomes and small samples cannot produce a model',()=>{
  assert.equal(learnModel([]).eligible,false);
  assert.equal(learnModel(candidates.slice(0,10)).eligible,false);
  assert.equal(learnModel(candidates.map(c=>({...c,managerRating:null}))).eligible,false);
});
test('scoring is deterministic, evidence-sensitive, linked and bounded',()=>{
  const c=SEED_COMPANIES[0];
  const evidence=[{id:'e1',snippet:'Recent digital expansion of multilingual customer care with billing complexity',isDemo:true}];
  const a=scoreCompany(c,evidence),b=scoreCompany(c,evidence);
  assert.deepEqual(a,b);
  assert.ok(a.score>scoreCompany(c,[]).score);
  assert.equal(a.breakdown.find(b=>b.label==='Executive accessibility')!.score,0);
  assert.ok(a.breakdown.some(b=>b.evidenceIds.includes('e1')));
  assert.ok(a.breakdown.every(b=>b.score>=0&&b.score<=b.max));
  assert.equal(dedupeCompany('  ACME   Ltd ','Germany'),dedupeCompany('acme ltd','germany'));
});
const now=new Date('2026-09-13T12:00:00Z');
const mention=(weeks:number,index:number,sentiment='NEGATIVE')=>({text:'Long hours and burnout',sourceDate:new Date(now.getTime()-weeks*7*86400000),sourceName:`Source ${index}`,sourceUrl:`https://source${index}.example`,sentiment,audienceLens:'CANDIDATE',isDemo:true,category:'Employer brand'});
test('radar clusters text, fills empty weeks, uses historical baseline, and requires evidence thresholds',()=>{
  assert.equal(classifyTheme('Long hours and burnout','Forum').label,'Workload and culture');
  const a=analyzeTheme('Workload and culture',[mention(6,0),mention(0,0),mention(0,1),mention(1,1)],now);
  assert.equal(a.trend.length,8);assert.equal(a.trend.filter(t=>t.mentionCount===0).length,5);
  assert.equal(a.qualifies,true);assert.equal(a.type,'RISK');assert.equal(a.confidence,'LOW');assert.equal(a.growth,5);
  assert.equal(analyzeTheme('Workload and culture',[mention(0,0),mention(0,0),mention(0,0)],now).qualifies,false);
  assert.equal(analyzeTheme('Workload and culture',[mention(0,0),mention(0,1)],now).qualifies,false);
  assert.equal(analyzeTheme('Workload and culture',[mention(10,0),mention(10,1),mention(10,2)],now).qualifies,false);
});
test('positive advocacy and competitor negatives yield opportunities with no fabricated growth baseline',()=>{
  const positive=analyzeTheme('Product value and advocacy',[mention(0,0,'POSITIVE'),mention(0,1,'POSITIVE'),mention(1,2,'POSITIVE')],now);
  assert.equal(positive.type,'OPPORTUNITY');assert.equal(positive.growth,null);
  const competitor=analyzeTheme('Competitor instability',[mention(0,0),mention(0,1),mention(1,2)],now);
  assert.equal(competitor.type,'OPPORTUNITY');assert.equal(competitor.qualifies,true);
});
