"""Offline Chromium UI smoke: network interactions mocked; actual function tests are in live.test.mjs."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,base64
r=Path(__file__).resolve().parent.parent
public=r/'public'
q=json.loads((r/'server/questions_public.json').read_text())
logo='data:image/png;base64,'+base64.b64encode((public/'assets/leafatlas-official-logo.png').read_bytes()).decode()
signature='a'*64
query='?topic=amblyopia&group=baseline&v=1.0.0&sig='+signature
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 errors=[]
 def start(file,scripts,viewport=(1180,800),fetchJS='',rewrite=None):
  page=b.new_page(viewport={'width':viewport[0],'height':viewport[1]})
  page.set_default_timeout(6500)
  page.on('pageerror',lambda e:errors.append(str(e)))
  html=(public/file).read_text()
  import re
  html=re.sub(r'<link[^>]*styles\.css[^>]*>', '', html)
  html=re.sub(r'<script src="/[^"]+"></script>','',html)
  page.set_content(html)
  page.add_style_tag(content=(public/'assets/styles.css').read_text())
  page.locator('img.brand-logo-wide').evaluate('(img,url)=>img.src=url',logo)
  if file=='patient-survey.html': page.add_script_tag(content="if(!crypto.randomUUID) Object.defineProperty(crypto,'randomUUID',{value:()=> '8a67ad02-f74d-4c49-a197-3c8991f2368b'});")
  if fetchJS:page.add_script_tag(content=fetchJS)
  for script in scripts:
   js=(public/'assets'/script).read_text()
   if rewrite:js=rewrite(js)
   page.add_script_tag(content=js)
  return page
 def mockJSON(obj):return 'new Response(JSON.stringify('+json.dumps(obj)+'),{status:200,headers:{"content-type":"application/json"}})'
 adminFetch='''window.fetch=async (url,opts={})=>{
    if(String(url)==='/.netlify/functions/status')return '''+mockJSON({'collectionEnabled':True,'questionnaireVersion':'1.0.0'})+''';
    if(String(url)==='/.netlify/functions/issue-link')return '''+mockJSON({'url':'https://leafatlas-audit.netlify.app/patient-survey.html'+query})+''';
    throw Error('Unexpected request: '+url);
 };'''
 admin=start('index.html',['questions.js','qr.js','admin.js'],fetchJS=adminFetch)
 assert admin.get_by_role('heading',name='Patient understanding audit.').is_visible()
 assert admin.locator('img.brand-logo-wide').evaluate('(e)=>e.naturalWidth')==233
 admin.locator('#staff-key').fill('A'*64)
 admin.get_by_role('button',name='Generate patient QR code').click()
 admin.locator('#qr-symbol svg').wait_for(state='visible')
 assert 'sig=' in admin.locator('#preview-button').get_attribute('href')
 admin.screenshot(path=str(r/'preview/live-qr-desktop.png'),full_page=True)
 patientFetch='''window.fetch=async url=>{
    if(String(url)==='/.netlify/functions/status')return '''+mockJSON({'collectionEnabled':True,'questionnaireVersion':'1.0.0'})+''';
    if(String(url).startsWith('/.netlify/functions/check-link'))return '''+mockJSON({'valid':True})+''';
    if(String(url)==='/.netlify/functions/submit')return '''+mockJSON({'recorded':True})+''';
    throw Error('Unexpected request: '+url);
 };'''
 patient=start('patient-survey.html',['questions.js','patient.js'],viewport=(390,844),fetchJS=patientFetch,rewrite=lambda s:s.replace('new URLSearchParams(location.search)', 'new URLSearchParams('+json.dumps(query)+')'))
 print('Patient panel:',patient.locator('#survey-panel').inner_text()[:350], 'errors:',errors); patient.get_by_text('Question 1 of 10').wait_for()
 patient.screenshot(path=str(r/'preview/live-patient-mobile.png'),full_page=True)
 patient.locator('input[name=answer][value=T]').check()
 patient.locator('#next-button').click()
 patient.get_by_text('Question 2 of 10').wait_for()
 patient.get_by_role('button',name='Back',exact=False).click()
 assert patient.locator('input[name=answer][value=T]').is_checked()
 for i in range(10):
  if i<8:patient.locator('input[name=answer][value=T]').check()
  else:patient.locator('label.rating:has(input[value="7"])').click()
  patient.locator('#next-button').click()
 patient.get_by_role('heading',name='Thank you for taking part').wait_for()
 assert 'recorded successfully' in patient.locator('#survey-panel').inner_text()
 data=[]
 for t in q['topics']:
  for group in ['baseline','leafatlas']:
   n=1 if t['id']=='amblyopia' and group=='baseline' else 0
   data.append({'topicId':t['id'],'group':group,'version':'1.0.0','n':n,'high':0,'pctHigh':0 if n else None,'meanScore':0 if n else None,'confidence9':7 if n else None,'confidence10':7 if n else None,'items':[{'counts':{'T':n,'F':0,'U':0},'correct':0,'pctCorrect':0 if n else None} for _ in range(8)]})
 dashFetch='''window.fetch=async url=>{
    if(String(url)==='/.netlify/functions/summary')return '''+mockJSON({'kind':'leafatlas-summary-v1','collectionEnabled':True,'data':data})+''';
    throw Error('Unexpected request: '+url);
 };'''
 dashboard=start('dashboard.html',['questions.js','dashboard.js'],fetchJS=dashFetch)
 assert dashboard.get_by_role('heading',name='Results dashboard').is_visible()
 assert dashboard.get_by_role('button',name='Export responses CSV').is_hidden()
 dashboard.locator('#staff-key').fill('A'*64)
 dashboard.get_by_role('button',name='Load results').click()
 dashboard.locator('#dashboard').wait_for(state='visible')
 assert dashboard.locator('.data-table tbody tr').count()==10
 dashboard.locator('#filter-topic').select_option('amblyopia')
 assert dashboard.locator('.kpi').count()==4
 dashboard.screenshot(path=str(r/'preview/live-results-dashboard.png'),full_page=True)
 assert not errors,errors
 print('PASS UI: logo, signed QR screen, 10 mobile questions with Back, submission confirmation, real results dashboard controls')
 b.close()
