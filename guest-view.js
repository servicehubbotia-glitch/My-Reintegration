// The public journal uses its confirmed snapshot for navigation and downloads.
'use strict';
(()=>{
 if(!cloud?.guest)return;
 document.body.classList.add('guest-view');
 let initialized=false;
 const requested=new URLSearchParams(window.location.search);
 function remember(){
  if(window.location.hostname!=='servicehubbotia-glitch.github.io'&&!requested.has('view'))return;
  const url=new URL(window.location.href);url.searchParams.set('date',selected);
  url.searchParams.delete('week');url.searchParams.delete('edit');
  window.history.replaceState(null,'',url);
 }
 function firstDate(){
  const explicit=requested.get('date')||window.MR_INITIAL_DATE;
  if(validDate(explicit))return explicit;
  const requestedWeek=requested.get('week');
  if(validDate(requestedWeek)){
   const start=monday(requestedWeek);
   return allDates().find(d=>d>=start&&d<=plus(start,6))||start;
  }
  return latestDate();
 }
 function clear(message){
  state=empty();$('#reportText').textContent='';
  for(const id of ['emailTo','emailSubject','emailBody'])$('#'+id).value='';
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();
  document.body.dataset.journalState='unavailable';
  $('#loadMessage').hidden=false;
  $('#loadMessage').textContent=message||'The journal could not be loaded. Select Refresh to try again.';
 }
 cloud.onStatus(event=>{
  if(event.role){document.body.dataset.journalState='ready';$('#loadMessage').hidden=true;return}
  if(/Loading|Reconnecting/.test(event.status)){
   if(!initialized){document.body.dataset.journalState='loading';$('#loadMessage').hidden=false;$('#loadMessage').textContent='Loading recorded activities and applications…'}
  }else clear(event.message);
 });
 function initialWeek(){
  const requestedDate=requested.get('date')||window.MR_INITIAL_DATE||requested.get('week');
  return validDate(requestedDate)?monday(requestedDate):undefined;
 }
 async function load(operation='read',handler,event,targetWeek){
  try{
   const chosen=targetWeek===null?undefined:(targetWeek??(initialized?week:initialWeek()));
   state=validate(await cloud.authorizedRead(operation,chosen));
   if(!initialized){selected=firstDate();week=monday(selected);initialized=true}
   else if(targetWeek===null){selected=latestDate();week=monday(selected)}
   remember();
   document.body.dataset.journalState='ready';$('#loadMessage').hidden=true;render();
   if($('#reportDialog').open)fillReport();
   return await handler?.(event);
  }catch(e){clear(e.message);toast(e.message)}
 }
 for(const id of ['activityTab','applicationTab','days']){
  const handler=$('#'+id).onclick;
  $('#'+id).onclick=e=>{if(!cloud.role)return;handler?.(e);remember()};
 }
 for(const id of ['prev','next','today']){
  const handler=$('#'+id).onclick;
  $('#'+id).onclick=e=>{if(!cloud.role)return;handler?.(e);remember();load('read',undefined,undefined,week)};
 }
 $('#latest').onclick=()=>{if(cloud.role)load('read',undefined,undefined,null)};
 const change=$('#jump').onchange;
 $('#jump').onchange=e=>{if(!cloud.role)return;change(e);remember();load('read',undefined,undefined,week)};
 for(const id of ['report','pdf','excel','csv','copy']){
  const handler=$('#'+id).onclick;
  $('#'+id).onclick=e=>{
   if(!cloud.role)return toast('Load the journal with Refresh before opening or downloading a report.');
   return handler?.(e);
  };
 }
 $('#refresh').onclick=()=>load();
 $('#allData').hidden=true;
 document.querySelector('#reportScope option[value="all"]')?.remove();
 document.querySelector('.intro p.muted').textContent='Activities, courses and applications — view a selected week and download its report.';
 document.querySelector('footer').textContent='Shared read-only journal. Only the selected week is provided by the public reader. Contact details are hidden. Select Refresh to load updates.';
 const publicUrl=window.MR_GOOGLE_CONFIG?.publicUrl||'https://servicehubbotia-glitch.github.io/My-Reintegration/';
 document.querySelector('.brand').href=publicUrl;
 const editUrl=new URL(publicUrl);editUrl.search='';editUrl.hash='';editUrl.searchParams.set('edit','1');
 const editLink=document.createElement('a');editLink.href=editUrl.href;editLink.textContent='Edit my journal';
 document.querySelector('footer').append(document.createTextNode(' '),editLink);
 window.addEventListener('pagehide',()=>cloud.disconnect());
 window.addEventListener('pageshow',e=>{if(e.persisted)load()});
 load();
})();
