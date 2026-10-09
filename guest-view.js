// A direct read-only link, with a fresh snapshot for each report or download.
'use strict';
(()=>{
 document.body.classList.add('guest-view');
 const clear=()=>{state=empty();$('#reportText').textContent='';for(const id of ['emailTo','emailSubject','emailBody'])$('#'+id).value='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());render()};
 cloud.onStatus(event=>{if(!event.role)clear()});
 async function load(operation,handler,event){
  try{state=validate(await cloud.authorizedRead(operation,week));render();return await handler?.(event)}catch(e){if(!cloud.role)clear();toast(e.message)}
 }
 for(const id of ['prev','next','today','activityTab','applicationTab','days']){const handler=$('#'+id).onclick;$('#'+id).onclick=e=>load('read',handler,e)}
 const change=$('#jump').onchange;$('#jump').onchange=e=>load('read',change,e);
 for(const [id,operation] of [['report','report'],['pdf','export.pdf'],['excel','export.xlsx'],['csv','export.csv'],['copy','export.copy']]){
  const handler=$('#'+id).onclick;$('#'+id).onclick=e=>load(operation,handler,e);
 }
 $('#refresh').onclick=()=>load('read');
 document.querySelector('.intro p.muted').textContent='Activities, courses and applications — a clear view of weekly progress.';
 document.querySelector('footer').textContent='Shared read-only journal. View the activities and download the weekly report as PDF or Excel.';
 window.addEventListener('pagehide',()=>{cloud.disconnect();clear()});
 window.addEventListener('pageshow',e=>{if(e.persisted)load('read')});
 load('read');
})();
