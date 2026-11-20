import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {TOPICS,sign,verifySignature,validatePayload,aggregate,exportRows,enabled,staffAuthorized,VERSION} from '../server/core.mjs';
import {setTestStore} from '../server/storage.mjs';
import status from '../netlify/functions/status.mjs';
import issue from '../netlify/functions/issue-link.mjs';
import checkLink from '../netlify/functions/check-link.mjs';
import submit from '../netlify/functions/submit.mjs';
import summary from '../netlify/functions/summary.mjs';
import exportCSV from '../netlify/functions/export.mjs';

const origin='https://leafatlas-audit.netlify.app';
process.env.NODE_ENV='test';
process.env.STAFF_ACCESS_KEY='A'.repeat(64);
process.env.QR_SIGNING_SECRET='B'.repeat(64);
process.env.AUDIT_PUBLIC_ORIGIN=origin;
process.env.AUDIT_ENVIRONMENT='production';
process.env.CLINICAL_QI_IG_APPROVED='YES';
process.env.RESPONSES_ENABLED='true';

const memory=new Map();
const store={
  async setJSON(key,value,{onlyIfNew}={}) {if(onlyIfNew&&memory.has(key))return {modified:false};memory.set(key,structuredClone(value));return {modified:true}},
  async get(key) {return memory.get(key)??null},
  async list({prefix}) {return {blobs:[...memory.keys()].filter(x=>x.startsWith(prefix)).map(key=>({key}))}}
};
setTestStore(store);
const req=(route,opt={})=>new Request(origin+route,opt);
const auth={'authorization':'Bearer '+process.env.STAFF_ACCESS_KEY};
const body=(data, extra={})=>({method:'POST',headers:{'content-type':'application/json',origin,...extra},body:JSON.stringify(data)});
function makePayload(topicId='amblyopia',group='baseline'){
 const t=TOPICS[topicId];
 return {topic:topicId,group,version:t.version,signature:sign(topicId,group,t.version),submissionId:randomUUID(),answers:Object.fromEntries(t.questions.map(q=>[q.id,q.type==='knowledge'?'U':5]))};
}
test('all five clinically approved questionnaires use 8+2 fixed questions',()=>{
 assert.equal(VERSION,'1.0.0');assert.equal(Object.keys(TOPICS).length,5);
 for(const t of Object.values(TOPICS)){
  assert.equal(t.questions.length,10);
  assert.equal(t.questions.filter(q=>q.type==='knowledge').length,8);
  assert.equal(t.questions.filter(q=>q.type==='confidence').length,2);
  assert.equal(new Set(t.questions.map(q=>q.id)).size,10);
  assert.equal(t.version,VERSION);
 }
});
test('responses are explicitly enabled only after required configuration',()=>{
 assert.equal(enabled(),true);
 process.env.CLINICAL_QI_IG_APPROVED='NO';assert.equal(enabled(),false);
 process.env.CLINICAL_QI_IG_APPROVED='YES';
 process.env.AUDIT_ENVIRONMENT='staging';assert.equal(enabled(),false);
 process.env.AUDIT_ENVIRONMENT='production';
 process.env.AUDIT_PUBLIC_ORIGIN='http://leafatlas-audit.netlify.app';assert.equal(enabled(),false);
 process.env.AUDIT_PUBLIC_ORIGIN=origin;
});
test('staff authentication is mandatory, signed QR cannot be relabelled',()=>{
 assert.equal(staffAuthorized(req('/api/summary')),false);
 assert.equal(staffAuthorized(req('/api/summary',{headers:auth})),true);
 const p=makePayload();assert.equal(verifySignature(p),true);
 assert.equal(verifySignature({...p,group:'leafatlas'}),false);
 assert.throws(()=>validatePayload({...p,group:'leafatlas'}));
 assert.throws(()=>validatePayload({...p,answers:{...p.answers,bad:'F'}}));
 assert.throws(()=>validatePayload({...p,answers:{...p.answers,[TOPICS.amblyopia.questions[9].id]:11}}));
 assert.throws(()=>validatePayload({...p,submissionId:'not-a-uuid'}));
});
test('signed patient links require authorised staff and approved primary origin',async()=>{
 assert.equal((await issue(req('/api/issue-link',body({topic:'amblyopia',group:'baseline'})))).status,401);
 const r=await issue(req('/api/issue-link',body({topic:'amblyopia',group:'leafatlas'},auth)));
 assert.equal(r.status,200);
 const url=new URL((await r.json()).url);
 assert.equal(url.origin,origin);assert.equal(url.pathname,'/patient-survey.html');assert.equal(url.searchParams.get('group'),'leafatlas');
 const check=await checkLink(req('/api/check-link?'+url.searchParams));
 assert.deepEqual(await check.json(),{valid:true});
 const invalid=await checkLink(req('/api/check-link?'+new URLSearchParams({topic:'amblyopia',group:'baseline',v:VERSION,sig:url.searchParams.get('sig')})));
 assert.deepEqual(await invalid.json(),{valid:false});
 const previewRequest=new Request('https://preview--leafatlas.netlify.app/api/issue-link',body({topic:'amblyopia',group:'baseline'},auth));
 assert.equal((await issue(previewRequest)).status,403);
});
test('live submission is persisted; repeat retry is idempotent; staff sees exactly one',async()=>{
 const p=makePayload();
 let res=await submit(req('/api/submit',body(p)));assert.equal(res.status,201);assert.equal((await res.json()).recorded,true);
 res=await submit(req('/api/submit',body(p)));assert.equal(res.status,200);assert.equal((await res.json()).alreadyRecorded,true);
 const changed={...p,answers:{...p.answers,[TOPICS.amblyopia.questions[0].id]:'T'}};
 assert.equal((await submit(req('/api/submit',body(changed)))).status,409);
 const unauth=await summary(req('/api/summary'));assert.equal(unauth.status,401);
 res=await summary(req('/api/summary',{headers:auth}));assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.data.length,10);
 assert.equal(data.data.reduce((acc,d)=>acc+d.n,0),1);
 assert.equal(data.data.find(d=>d.topicId==='amblyopia'&&d.group==='baseline').n,1);
 assert.equal(memory.size,1);
});
test('full ten-question score, not sure 0; confidence /10 and item percentages',()=>{
 const t=TOPICS.amblyopia;
 const choices=['T','F','T','T','T','F','F','T'];
 const answers=Object.fromEntries(t.questions.map((q,i)=>[q.id,i<8?choices[i]:i===8?9:6]));
 const summary=aggregate([{topicId:t.id,group:'leafatlas',version:t.version,answers}]);
 const score=summary.data.find(x=>x.topicId==='amblyopia'&&x.group==='leafatlas');
 assert.equal(score.n,1);assert.equal(score.meanScore,8);assert.equal(score.high,1);assert.equal(score.pctHigh,100);
 assert.equal(score.confidence9,9);assert.equal(score.confidence10,6);assert.equal(score.items[0].pctCorrect,100);
 assert.equal(aggregate([{topicId:t.id,group:'baseline',version:t.version,answers:Object.fromEntries(t.questions.map(q=>[q.id,q.type==='knowledge'?'U':0]))}]).data.find(x=>x.topicId==='amblyopia'&&x.group==='baseline').meanScore,0);
});
test('raw CSV requires staff key, has no patient identifiers, supports filters',async()=>{
 assert.equal((await exportCSV(req('/api/export'))).status,401);
 let r=await exportCSV(req('/api/export?topic=amblyopia&group=baseline',{headers:auth}));
 assert.equal(r.status,200);
 const csv=await r.text();
 assert.match(csv,/response_id,received_date_utc,topic,group/);
 assert.match(csv,/U,U,U,U,U,U,U,U,5,5/); // answers are present on the full export
 assert.doesNotMatch(csv,/(patient_name|nhs_number|date_of_birth|postcode|email)/i);
 assert.equal(csv.trim().split('\r\n').length,2);
 r=await exportCSV(req('/api/export?topic=bad',{headers:auth}));assert.equal(r.status,400);
});
test('no live response collected if configuration is disabled',async()=>{
 process.env.RESPONSES_ENABLED='false';
 const before=memory.size;
 const r=await submit(req('/api/submit',body(makePayload())));
 assert.equal(r.status,503);assert.equal(memory.size,before);
 assert.equal((await status(req('/api/status')).then(r=>r.json())).collectionEnabled,false);
 process.env.RESPONSES_ENABLED='true';
});
