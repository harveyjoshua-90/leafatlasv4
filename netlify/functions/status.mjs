import {json,noMethod,enabled,VERSION,requestOnApprovedHost} from '../../server/core.mjs';
export default async req => req.method === 'GET' ? json({collectionEnabled:enabled() && requestOnApprovedHost(req),questionnaireVersion:VERSION}) : noMethod();
