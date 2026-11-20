import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {PUBLIC, ANSWERS} from './catalog.mjs';

export const TOPICS = Object.fromEntries(PUBLIC.topics.map(t => [t.id, t]));
export const GROUPS = ['baseline', 'leafatlas'];
export const VERSION = PUBLIC.questionnaire_version;
const APPROVED_ORIGIN = () => (process.env.AUDIT_PUBLIC_ORIGIN || '').replace(/\/$/, '');

export function signingReady() {
  return (process.env.STAFF_ACCESS_KEY || '').length >= 32 &&
    (process.env.QR_SIGNING_SECRET || '').length >= 32;
}
export function enabled() {
  const origin = APPROVED_ORIGIN();
  let validHttpsOrigin = false;
  try {
    const u = new URL(origin);
    validHttpsOrigin = u.protocol === 'https:' && u.origin === origin && !u.username && !u.password;
  } catch {}
  return signingReady() && validHttpsOrigin &&
    process.env.RESPONSES_ENABLED === 'true' &&
    process.env.CLINICAL_QI_IG_APPROVED === 'YES' &&
    process.env.AUDIT_ENVIRONMENT === 'production';
}
function constantEqual(x, y) {
  const a = createHash('sha256').update(String(x)).digest();
  const b = createHash('sha256').update(String(y)).digest();
  return timingSafeEqual(a, b);
}
export function staffAuthorized(req) {
  const configured = process.env.STAFF_ACCESS_KEY || '';
  const auth = req.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return signingReady() && key.length >= 32 && key.length <= 512 && constantEqual(configured, key);
}
export function sameOrigin(req) {
  const o = req.headers.get('origin');
  const source = new URL(req.url);
  // A browser-origin check blocks cross-origin scripts. Server clients without Origin
  // can still call public submit by design (the QR link is a public invitation).
  return !o || o === source.origin;
}
export function requestOnApprovedHost(req) {
  return new URL(req.url).origin === APPROVED_ORIGIN();
}
export function sign(topicId, group, version) {
  if (!signingReady()) throw Error('Service not configured');
  return createHmac('sha256', process.env.QR_SIGNING_SECRET)
    .update(`leafatlas-qr-v1|${topicId}|${group}|${version}`).digest('hex');
}
export function verifySignature(p) {
  return typeof p.signature === 'string' && /^[0-9a-f]{64}$/.test(p.signature) &&
    constantEqual(p.signature, sign(p.topic, p.group, p.version));
}
export function validatePayload(p) {
  const exact = ['answers','group','signature','submissionId','topic','version'].sort().join(',');
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).sort().join(',') !== exact)
    throw Error('Invalid form fields');
  const t = TOPICS[p.topic];
  if (!t || !GROUPS.includes(p.group) || p.version !== t.version || !verifySignature(p))
    throw Error('Invalid questionnaire link');
  if (typeof p.submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.submissionId))
    throw Error('Invalid submission reference');
  if (!p.answers || typeof p.answers !== 'object' || Array.isArray(p.answers))
    throw Error('Invalid answers');
  const fields = Object.keys(p.answers).sort();
  const ids = t.questions.map(q => q.id).sort();
  if (fields.length !== 10 || fields.some((key, i) => key !== ids[i]))
    throw Error('All ten questions must be completed');
  for (const q of t.questions) {
    const val = p.answers[q.id];
    if (q.type === 'knowledge') {
      if (!['T', 'F', 'U'].includes(val)) throw Error('Invalid knowledge choice');
    } else if (!Number.isInteger(val) || val < 0 || val > 10) {
      throw Error('Invalid confidence rating');
    }
  }
  return {
    submissionId: p.submissionId,
    topicId: t.id, group: p.group, version: t.version,
    answers: Object.fromEntries(t.questions.map(q => [q.id, p.answers[q.id]]))
  };
}
export function aggregate(records) {
  const valid = records.filter(r => r && TOPICS[r.topicId] && GROUPS.includes(r.group) && r.version === TOPICS[r.topicId].version);
  const out = [];
  const avg = values => values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
  for (const t of PUBLIC.topics) {
    const key = ANSWERS.keys[t.id];
    for (const group of GROUPS) {
      const rows = valid.filter(r => r.topicId === t.id && r.group === group);
      const n = rows.length;
      const scores = rows.map(r => t.questions.filter(q => q.type === 'knowledge' && r.answers?.[q.id] === key[q.id]).length);
      const high = scores.filter(x => x >= 6).length;
      const conf = qid => avg(rows.map(r => r.answers?.[qid]).filter(x => Number.isInteger(x) && x >= 0 && x <= 10));
      const items = t.questions.filter(q => q.type === 'knowledge').map(q => {
        const counts = {T:0, F:0, U:0};
        for (const r of rows) if (['T','F','U'].includes(r.answers?.[q.id])) counts[r.answers[q.id]]++;
        const correct = counts[key[q.id]];
        return {id:q.id, number:q.number, counts, correct, pctCorrect:n ? correct * 100 / n : null};
      });
      out.push({topicId:t.id, group, version:t.version, n, high,
        pctHigh:n ? high * 100 / n : null, meanScore:avg(scores),
        confidence9:conf(t.questions[8].id), confidence10:conf(t.questions[9].id), items});
    }
  }
  return {kind:'leafatlas-summary-v1',collectionEnabled:enabled(),data:out};
}
export function csvEncode(v) {
  let s = String(v ?? '');
  if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function exportRows(records, topicFilter='all', groupFilter='both') {
  const filtered = records.filter(r => r && TOPICS[r.topicId] && GROUPS.includes(r.group) &&
    r.version === TOPICS[r.topicId].version && (topicFilter === 'all' || r.topicId === topicFilter) &&
    (groupFilter === 'both' || r.group === groupFilter));
  const header = ['response_id','received_date_utc','topic','group','questionnaire_version','knowledge_score_8','scored_6plus',...Array.from({length:10}, (_,i) => `q${i+1}`)];
  const rows = [header];
  for (const r of filtered) {
    const t = TOPICS[r.topicId], answerKey = ANSWERS.keys[r.topicId];
    const score = t.questions.filter(q => q.type === 'knowledge' && r.answers?.[q.id] === answerKey[q.id]).length;
    rows.push([r.submissionId, r.receivedOn, r.topicId, r.group, r.version, score, score >= 6 ? 1 : 0,
      ...t.questions.map(q => r.answers?.[q.id] ?? '')]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvEncode).join(',')).join('\r\n') + '\r\n';
}
export function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, private',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff'
  }});
}
export const noMethod = () => json({error:'Method not allowed'}, 405);
export async function safeBody(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) throw Error('Invalid request type or size');
  if (Number(req.headers.get('content-length') || 0) > 4096) throw Error('Request is too large');
  const content = await req.text();
  if (content.length > 4096) throw Error('Request is too large');
  try { return JSON.parse(content); } catch { throw Error('Invalid JSON'); }
}
export const USER_ERRORS = ['Invalid form fields','Invalid answers','Invalid questionnaire link','Invalid submission reference',
 'All ten questions must be completed','Invalid knowledge choice','Invalid confidence rating','Invalid request type or size',
 'Request is too large','Invalid JSON'];
