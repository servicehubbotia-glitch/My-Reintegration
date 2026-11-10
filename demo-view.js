// Adapt the existing journal interface to an isolated, fictitious demonstration.
'use strict';
(()=>{
 if(window.MR_MODE!=='demo'||!cloud?.demo)return;
 document.body.classList.add('demo-view');
 document.title='My Reintegration — Demo';
 const blocked=['connect','refresh','signout','settings','privateAccess','shareView','backup','import','legacyBackup','migrate','retry','pendingBackup','resolvePending','email','eml','copyViewLink','openSharedView','createPrivateLink','refreshPrivateLinks','accessExpiry'];
 const prevent=event=>{event?.preventDefault();event?.stopImmediatePropagation()};
 function hidePrivateControls(){
  for(const id of blocked){
   const element=$('#'+id);if(!element)continue;
   element.hidden=true;element.dataset.demoHidden='true';element.disabled=true;
   element.onclick=prevent;element.onchange=prevent;
   if(id==='openSharedView')element.removeAttribute('href');
  }
  for(const selector of ['#preferences','#accessManager','.email-section','#import']){
   const element=document.querySelector(selector);if(!element)continue;
   const target=selector==='#import'?element.closest('label')||element:element;
   target.hidden=true;target.dataset.demoHidden='true';
  }
  $('#settingsForm').onsubmit=prevent;
  for(const id of ['emailTo','emailSubject','emailBody'])$('#'+id).disabled=true;
 }
 const banner=document.createElement('section');banner.id='demoBanner';banner.className='demo-banner';banner.setAttribute('aria-labelledby','demoTitle');
 const title=document.createElement('h2');title.id='demoTitle';title.textContent='DEMO — fictitious data';
 const explanation=document.createElement('p');explanation.textContent='Try adding or editing fictional records. Changes stay in this tab and disappear when you reload or reset. Use fictional information only.';
 const actions=document.createElement('div');actions.className='actions';
 const resetButton=document.createElement('button');resetButton.id='resetDemo';resetButton.type='button';resetButton.textContent='Reset demo';
 const publicUrl=new URL(window.location.href);publicUrl.search='';publicUrl.hash='';
 const editUrl=new URL(publicUrl);editUrl.searchParams.set('edit','1');
 const editLink=document.createElement('a');editLink.id='demoEditLink';editLink.href=editUrl.href;editLink.textContent='Edit my journal';
 actions.append(resetButton,editLink);banner.append(title,explanation,actions);document.querySelector('main').prepend(banner);
 document.querySelector('.brand').href=publicUrl.href;
 document.querySelector('.intro .eyebrow').textContent='EXPLORE A FICTIONAL JOURNAL';
 document.querySelector('.intro p.muted').textContent='Explore two sample weeks, try editing records, and download clearly marked demo reports.';
 document.querySelector('footer').textContent='Public demo with fictitious records. Changes are kept only in this tab until you reload or reset. Open Edit my journal to access your private records.';
 document.querySelector('#reportDialog .eyebrow').textContent='DEMO REPORT — FICTIONAL RECORDS';
 $('#report').textContent='Demo weekly report ↗';$('#allData').textContent='All demo data & downloads';
 $('#draftStatus').textContent='Demo changes stay only in this tab.';
 async function show(method){
  resetButton.disabled=true;
  try{
   state=validate(await cloud[method]());editing=null;reportScope='week';view='activities';
   selected=latestDate();week=monday(selected);
   document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
   $('#fields').innerHTML='';$('#reportText').textContent='';
   for(const id of ['emailTo','emailSubject','emailBody'])$('#'+id).value='';
   document.body.dataset.journalState='ready';$('#loadMessage').hidden=true;
   render();hidePrivateControls();
  }finally{resetButton.disabled=false}
 }
 resetButton.onclick=()=>show('reset').then(()=>toast('Demo reset. The fictional sample records are restored.')).catch(()=>toast('Could not reset the demo. Reload this page.'));
 cloud.onStatus(hidePrivateControls);
 show('connect').catch(()=>toast('Could not load the demo. Reload this page.'));
})();
