import {json,noMethod,staffAuthorized,enabled,TOPICS,GROUPS,exportRows,requestOnApprovedHost} from '../../server/core.mjs';
import {readAllRecords} from '../../server/storage.mjs';
export default async req => {
  if (req.method !== 'GET') return noMethod();
  if (!staffAuthorized(req)) return json({error:'Staff access denied'},401);
  if (!requestOnApprovedHost(req)) return json({error:'This host is not the approved audit address.'},403);
  if (!enabled()) return json({error:'Response export is not available.'},503);
  const params = new URL(req.url).searchParams;
  const topic = params.get('topic') || 'all', group = params.get('group') || 'both';
  if ((topic !== 'all' && !TOPICS[topic]) || (group !== 'both' && !GROUPS.includes(group)))
    return json({error:'Invalid export filters'},400);
  try {
    const rows = exportRows(await readAllRecords(), topic, group);
    return new Response(rows, {status:200,headers:{
      'content-type':'text/csv; charset=utf-8',
      'content-disposition':'attachment; filename="LeafAtlas_patient_understanding_responses.csv"',
      'cache-control':'no-store, private', 'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer'
    }});
  } catch { return json({error:'The response export service is unavailable.'},503); }
};
