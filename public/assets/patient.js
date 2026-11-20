'use strict';
// Parent page: the clinical answer key is not shipped to browsers; answers are sent only to the server.
const PUBLIC=window.LEAFATLAS_QUESTIONS;
const BY_ID=Object.fromEntries(PUBLIC.topics.map(t=>[t.id,t]));
const params=new URLSearchParams(location.search);
const topicId=params.get('topic'),group=params.get('group'),signature=params.get('sig')||'',v=params.get('v')||'';
const topic=BY_ID[topicId];
const valid=Boolean(topic&&['baseline','leafatlas'].includes(group)&&v===topic.version&&/^[0-9a-f]{64}$/.test(signature));
const state={step:0,answers:{},sending:false,finished:false,error:'',ready:false,checked:false,submissionId:crypto.randomUUID()};
const $=id=>document.getElementById(id);
const h=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showCard(title,message){$('survey-panel').innerHTML=`<section class="card main-card"><h2>${h(title)}</h2><p class="muted">${h(message)}</p></section>`}
function render() {
  const target=$('survey-panel');
  if (!valid) return showCard('Questionnaire link not recognised','Please ask your orthoptic team for a valid QR code.');
  if (!state.checked) return showCard('Loading questionnaire','Checking the survey service…');
  if (!state.ready && !state.finished) return showCard('Questionnaire temporarily unavailable','Please ask the orthoptic team for assistance. Your answers have not been submitted.');
  if (state.finished) {
    target.innerHTML='<section class="card main-card"><div class="thanks-icon" aria-hidden="true">✓</div><h2>Thank you for taking part</h2><p class="muted">Your answers have been recorded successfully.</p></section>';
    return;
  }
  const q=topic.questions[state.step], selected=state.answers[q.id];
  const options=q.type==='knowledge'?
    `<div class="choice-list" role="radiogroup" aria-label="Choose an answer">${[['T','True'],['F','False'],['U','Not sure']].map(([value,label])=>`<label class="choice"><input name="answer" type="radio" value="${value}" ${value===selected?'checked':''}><span>${label}</span></label>`).join('')}</div>`:
    `<div role="group" aria-label="Confidence rating"><div class="ratings">${Array.from({length:11},(_,i)=>`<label class="rating"><input name="answer" type="radio" value="${i}" ${i===selected?'checked':''} aria-label="${i} out of 10"><span>${i}</span></label>`).join('')}</div><div class="scale-labels"><span>0 = Not at all confident</span><span>10 = Completely confident</span></div></div>`;
  target.innerHTML=`<div class="layout"><section class="card main-card"><div class="question-head"><span>Question ${state.step+1} of 10</span><span>${(state.step+1)*10}% complete</span></div><div class="progress" role="progressbar" aria-valuenow="${state.step+1}" aria-valuemin="0" aria-valuemax="10"><div style="width:${(state.step+1)*10}%"></div></div><span class="section-label">${q.type==='knowledge'?'What do you think?':'Your confidence'}</span><h2 id="current-question" tabindex="-1" class="question-text">${h(q.text)}</h2><p class="question-helper">${q.type==='knowledge'?'Choose True, False or Not sure. It is fine not to be sure.':'Choose the number that best describes how you feel.'}</p>${options}${state.error?`<p class="validation" role="alert">${h(state.error)}</p>`:''}<div class="button-row">${state.step?'<button class="btn btn-secondary" data-action="back" type="button">← Back</button>':'<span></span>'}<button id="next-button" class="btn" data-action="next" type="button" ${selected===undefined||state.sending?'disabled':''}>${state.sending?'Submitting…':state.step===9?'Submit answers':'Next question →'}</button></div></section><aside class="card side-card"><span class="section-label">Your questionnaire</span><div class="topic-pill">${h(topic.title)}</div><p class="muted">Use Back to change an earlier answer. Your answers will only be sent when you select Submit answers.</p></aside></div>`;
}
async function next(){
  const q=topic.questions[state.step];
  if(state.answers[q.id]===undefined||state.sending){state.error='Please choose an answer before continuing.';render();return}
  if(state.step<9){state.step++;state.error='';render();$('current-question')?.focus();return}
  if(!topic.questions.every(q=>state.answers[q.id]!==undefined)){state.error='Please answer all ten questions.';render();return}
  state.error='';state.sending=true;render();
  try {
    const response=await fetch('/.netlify/functions/submit',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},cache:'no-store',body:JSON.stringify({topic:topicId,group,version:topic.version,signature,submissionId:state.submissionId,answers:state.answers})});
    const data=await response.json();
    if(!response.ok||data.recorded!==true)throw Error(data.error||'We could not save your answers.');
    state.finished=true;
  } catch(e) {state.error=e.message+' Please try again or ask your orthoptic team for help.'}
  finally{state.sending=false;render()}
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(a==='next')next();if(a==='back'&&!state.sending){state.step=Math.max(0,state.step-1);state.error='';render();$('current-question')?.focus()}});
document.addEventListener('change',e=>{if(e.target.name!=='answer'||!valid||state.sending)return;const q=topic.questions[state.step];state.answers[q.id]=q.type==='knowledge'?e.target.value:Number(e.target.value);state.error='';$('next-button').disabled=false;document.querySelector('.validation')?.remove()});
$('contrast-button').addEventListener('click',()=>{document.body.classList.toggle('contrast');$('contrast-button').setAttribute('aria-pressed',document.body.classList.contains('contrast'))});
(async()=>{
  if(!valid){state.checked=true;render();return}
  try {const response=await fetch('/.netlify/functions/status',{cache:'no-store'});const data=await response.json();
    if(response.ok&&data.collectionEnabled===true&&data.questionnaireVersion===topic.version){
      const check=await fetch('/.netlify/functions/check-link?'+new URLSearchParams({topic:topicId,group,v, sig:signature}),{cache:'no-store'});
      const verified=await check.json();
      state.ready=check.ok&&verified.valid===true;
    }}
  catch{state.ready=false}
  state.checked=true;render();
})();
render();
