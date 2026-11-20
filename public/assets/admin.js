'use strict';
const catalog = window.LEAFATLAS_QUESTIONS;
const byId = Object.fromEntries(catalog.topics.map(t => [t.id,t]));
const el = id => document.getElementById(id);
const topicEl = el('topic-select'), groupEl = el('group-select'), statusEl = el('status');
const chosen = new URLSearchParams(location.search);
let activeLink = '', activeFile = '', ready = false;
for (const t of catalog.topics) {
  const option = document.createElement('option');
  option.value=t.id;option.textContent=t.title;topicEl.append(option);
}
if (byId[chosen.get('topic')]) topicEl.value = chosen.get('topic');
if (['baseline','leafatlas'].includes(chosen.get('group'))) groupEl.value=chosen.get('group');
const notify = (message, error=false) => {
  statusEl.textContent = message;
  statusEl.className = 'status-text' + (error ? ' error' : '');
};
async function checkStatus() {
  try {
    const res = await fetch('/.netlify/functions/status', {cache:'no-store'});
    if (!res.ok) throw Error();
    const status = await res.json();
    ready = status.collectionEnabled === true;
    el('generate-button').disabled = !ready;
    notify(ready ? 'Live response collection is active. Generate signed patient links below.' :
      'The live service has not been activated. Please complete the Netlify environment settings.', !ready);
  } catch {
    ready = false; el('generate-button').disabled = true;
    notify('Unable to reach the survey service. Check the Netlify Functions deployment.', true);
  }
}
function svgFor(url) {
  const qr=new LeafAtlasQRCode(-1,LeafAtlasQRCodeLevels.M);
  qr.addData(url);qr.make();
  const n=qr.getModuleCount(),quiet=4,sz=n+quiet*2;
  const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz}" role="img" aria-label="QR code for the selected questionnaire"><rect width="${sz}" height="${sz}" fill="white"/>`];
  for (let y=0;y<n;y++) {let x=0;while(x<n){if(!qr.isDark(y,x)){x++;continue}const start=x;while(x<n&&qr.isDark(y,x))x++;pieces.push(`<rect x="${start+quiet}" y="${y+quiet}" width="${x-start}" height="1" fill="#101010"/>`)}}
  pieces.push('</svg>');return pieces.join('');
}
async function generate() {
  notify('');
  if (!ready) return notify('The live service is not active.',true);
  const key=el('staff-key').value.trim();
  if (!key) return notify('Enter your staff access key to generate a patient QR code.', true);
  el('generate-button').disabled=true;
  try {
    const res=await fetch('/.netlify/functions/issue-link', {method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key},body:JSON.stringify({topic:topicEl.value,group:groupEl.value})});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Could not create the link');
    const link = new URL(data.url);
    if (link.protocol !== 'https:') throw Error('The survey must use HTTPS.');
    const svg=svgFor(link.href);
    el('qr-symbol').innerHTML=svg;
    el('qr-symbol').querySelector('svg').classList.add('qr-graphic');
    activeLink=link.href;
    activeFile=`LeafAtlas_${topicEl.value}_${groupEl.value}_QR.svg`;
    el('qr-label').textContent=`${byId[topicEl.value].title} · ${groupEl.value==='baseline'?'Usual care':'LeafAtlas leaflet'}`;
    el('target-url').textContent=link.href;
    el('preview-button').href=link.href;
    el('qr-output').hidden=false;
    notify('Live patient QR code generated. The submitted answers will be recorded centrally.');
  } catch(e) {
    el('qr-output').hidden=true;
    notify(e.message, true);
  } finally {el('generate-button').disabled=!ready;}
}
function saveQR() {
  const svg=el('qr-symbol').querySelector('svg');if(!svg)return;
  const url=URL.createObjectURL(new Blob([svg.outerHTML],{type:'image/svg+xml'}));
  const a=document.createElement('a');a.href=url;a.download=activeFile;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
el('generate-button').addEventListener('click', generate);
el('download-button').addEventListener('click', saveQR);
el('copy-button').addEventListener('click', async()=>{
  try{await navigator.clipboard.writeText(activeLink);notify('Patient link copied.');}
  catch{notify('Copy the link displayed below the QR code.',true)}
});
el('print-button').addEventListener('click',()=>{document.body.classList.add('print-only-qr');window.print();setTimeout(()=>document.body.classList.remove('print-only-qr'),1000)});
for(const target of [topicEl,groupEl]) target.addEventListener('change',()=>{el('qr-output').hidden=true;activeLink=''});
el('contrast-button').addEventListener('click',()=>{document.body.classList.toggle('contrast');el('contrast-button').setAttribute('aria-pressed',document.body.classList.contains('contrast'))});
checkStatus();
