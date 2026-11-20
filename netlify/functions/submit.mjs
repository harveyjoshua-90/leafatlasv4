import {json,noMethod,enabled,sameOrigin,safeBody,validatePayload,USER_ERRORS,requestOnApprovedHost} from '../../server/core.mjs';
import {openStore} from '../../server/storage.mjs';
export default async req => {
  if (req.method !== 'POST') return noMethod();
  if (!enabled()) return json({error:'This questionnaire is temporarily unavailable. Please speak to your orthoptic team.'},503);
  if (!sameOrigin(req) || !requestOnApprovedHost(req)) return json({error:'Origin not allowed'},403);
  try {
    const p = await safeBody(req), validated = validatePayload(p);
    const store = await openStore();
    // Client-generated UUID makes retrying after a network drop safe without counting a parent twice.
    const record = {...validated, receivedOn:new Date().toISOString().slice(0,10)};
    const key = 'responses/' + validated.submissionId;
    const result = await store.setJSON(key, record, {onlyIfNew:true});
    if (result.modified === false) {
      const prior = await store.get(key, {type:'json', consistency:'strong'});
      if (!prior || prior.topicId !== validated.topicId || prior.group !== validated.group ||
        prior.version !== validated.version || JSON.stringify(prior.answers) !== JSON.stringify(validated.answers))
        return json({error:'This submission reference was already used.'},409);
      return json({recorded:true,alreadyRecorded:true},200);
    }
    return json({recorded:true},201);
  } catch (e) {
    if (USER_ERRORS.includes(e.message)) return json({error:e.message},400);
    return json({error:'Could not save your answers. Please try again or ask the orthoptic team for help.'},503);
  }
};
