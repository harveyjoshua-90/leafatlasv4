import {json,noMethod,staffAuthorized,TOPICS,GROUPS,sign,safeBody,sameOrigin,enabled,requestOnApprovedHost} from '../../server/core.mjs';
export default async req => {
  if (req.method !== 'POST') return noMethod();
  if (!staffAuthorized(req)) return json({error:'Staff access denied'},401);
  if (!sameOrigin(req) || !requestOnApprovedHost(req)) return json({error:'Origin not allowed'},403);
  if (!enabled()) return json({error:'The survey is not configured for live response collection.'},503);
  try {
    const p = await safeBody(req), t = TOPICS[p.topic];
    if (!p || Object.keys(p).sort().join(',') !== 'group,topic' || !t || !GROUPS.includes(p.group))
      return json({error:'Unknown questionnaire'},400);
    const url = new URL('/patient-survey.html', process.env.AUDIT_PUBLIC_ORIGIN);
    url.searchParams.set('topic',p.topic);
    url.searchParams.set('group',p.group);
    url.searchParams.set('v',t.version);
    url.searchParams.set('sig',sign(p.topic,p.group,t.version));
    return json({url:url.href});
  } catch { return json({error:'Unable to create a patient link.'},400); }
};
