// A site-wide store persists across deployments; the region is specified on EVERY access.
// Frankfurt (eu-central-1) is Netlify Blobs' closest EU region; it is NOT UK-only storage.
const OPTIONS = {name:'leafatlas-qi-approved-responses-v1', region:'eu-central-1', consistency:'strong'};
let testStore = null;
export function setTestStore(store) {
  if (process.env.NODE_ENV !== 'test') throw Error('Test store is not available in production');
  testStore = store;
}
export async function openStore() {
  if (process.env.NODE_ENV === 'test' && testStore) return testStore;
  const {getStore} = await import('@netlify/blobs');
  return getStore(OPTIONS);
}
export async function readAllRecords() {
  const store = await openStore();
  const {blobs} = await store.list({prefix:'responses/'});
  if (blobs.length > 6000) throw Error('REPORTING_LIMIT');
  const results = [];
  // Avoid large concurrent reads and Lambda timeouts on unusually large datasets.
  for (let i = 0; i < blobs.length; i += 50) {
    const batch = await Promise.all(blobs.slice(i,i+50).map(b => store.get(b.key, {type:'json', consistency:'strong'})));
    results.push(...batch.filter(Boolean));
  }
  return results;
}
