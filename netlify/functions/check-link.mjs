import {json,noMethod,enabled,requestOnApprovedHost,TOPICS,GROUPS,verifySignature} from '../../server/core.mjs';
export default async req => {
  if(req.method !== 'GET') return noMethod();
  if(!enabled() || !requestOnApprovedHost(req)) return json({valid:false},503);
  const p=new URL(req.url).searchParams;
  const topic=p.get('topic'),group=p.get('group'),version=p.get('v'),signature=p.get('sig');
  const valid=Boolean(TOPICS[topic] && GROUPS.includes(group) && TOPICS[topic].version===version &&
    verifySignature({topic,group,version,signature}));
  return json({valid});
};
