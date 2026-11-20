import {json,noMethod,staffAuthorized,enabled,aggregate,requestOnApprovedHost} from '../../server/core.mjs';
import {readAllRecords} from '../../server/storage.mjs';
export default async req => {
  if (req.method !== 'GET') return noMethod();
  if (!staffAuthorized(req)) return json({error:'Staff access denied'},401);
  if (!requestOnApprovedHost(req)) return json({error:'This host is not the approved audit address.'},403);
  if (!enabled()) return json({error:'The live results service is not configured.'},503);
  try { return json(aggregate(await readAllRecords())); }
  catch (e) { return json({error:e.message==='REPORTING_LIMIT'?'The audit exceeds the current dashboard reporting limit; contact your developer for a database migration.':'The results service is currently unavailable.'},503); }
};
