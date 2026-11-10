// The private reader uses its complete confirmed snapshot for navigation and downloads.
'use strict';
(()=>{
 if(window.MR_MODE!==undefined&&window.MR_MODE!=='reader')return;
 if(!cloud?.guest)return;
 document.body.classList.add('guest-view');
 let initialized=false,confirmed=false,readSequence=0;
 const requested=new URLSearchParams(window.location.search);
 function remember(){
  if(window.location.hostname!=='servicehubbotia-glitch.github.io'&&!requested.has('view'))return;
  const url=new URL(window.location.href);url.searchParams.set('date',selected);
  url.searchParams.delete('week');url.searchParams.delete('edit');
  window.history.replaceState(null,'',url);
 }
 function firstDate(){
  const explicit=cloud.initialDate||requested.get('date')||window.MR_INITIAL_DATE;
  if(validDate(explicit))return explicit;
  const requestedWeek=cloud.initialWeek||requested.get('week');
  if(validDate(requestedWeek)){
   const start=monday(requestedWeek);
   return allDates().find(d=>d>=start&&d<=plus(start,6))||start;
  }
  return latestDate();
 }
 function clear(message){
  clearPreparedDownload();
  confirmed=false;readSequence++;
  state=empty();$('#reportText').textContent='';
  $('#reportRange').textContent='';
  for(const id of ['emailTo','emailSubject','emailBody'])$('#'+id).value='';
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();
  document.body.dataset.journalState='unavailable';
  $('#loadMessage').hidden=false;
  $('#loadMessage').textContent=message||'The journal could not be loaded. Select Refresh to try again.';
 }
 cloud.onStatus(event=>{
  if(event.role){if(confirmed){document.body.dataset.journalState='ready';$('#loadMessage').hidden=true}return}
  if(/Loading|Reconnecting/.test(event.status)){
   if(!initialized){document.body.dataset.journalState='loading';$('#loadMessage').hidden=false;$('#loadMessage').textContent='Loading recorded activities and applications…'}
  }else clear(event.message);
 });
 async function load(){
  const sequence=++readSequence;
  try{
   const snapshot=validate(await cloud.authorizedRead('read'));
   if(sequence!==readSequence||!cloud.role)return;
   state=snapshot;confirmed=true;
   if(!initialized){selected=firstDate();week=monday(selected);initialized=true;remember()}
   document.body.dataset.journalState='ready';$('#loadMessage').hidden=true;render();
   if($('#reportDialog').open)fillReport();
  }catch(e){if(sequence===readSequence){clear(e.message);toast(e.message)}}
 }
 for(const id of ['prev','next','today','latest','activityTab','applicationTab','days']){
  const handler=$('#'+id).onclick;
  $('#'+id).onclick=e=>{if(!cloud.role||!confirmed)return;handler?.(e);remember()};
 }
 const change=$('#jump').onchange;
 $('#jump').onchange=e=>{if(!cloud.role||!confirmed)return;change(e);remember()};
 for(const id of ['report','allData','pdf','excel','csv','copy','backup','email','eml']){
  const handler=$('#'+id).onclick;
  $('#'+id).onclick=e=>{
   if(!cloud.role||!confirmed)return toast('Load the private journal with Refresh before opening or downloading a report.');
   return handler?.(e);
  };
 }
 const scopeChange=$('#reportScope').onchange;
 $('#reportScope').onchange=e=>{if(cloud.role&&confirmed)return scopeChange?.(e)};
 $('#refresh').onclick=()=>load();
 document.querySelector('.intro p.muted').textContent='Private activities, courses and applications — view the complete history and download a report.';
 document.querySelector('footer').textContent='Private read-only journal. Download the selected week or all recorded data as a spreadsheet, PDF or CSV. Reports use the loaded records. Select Refresh to load the latest records.';
 const publicUrl=window.MR_GOOGLE_CONFIG?.publicUrl||'https://servicehubbotia-glitch.github.io/My-Reintegration/';
 document.querySelector('.brand').href=publicUrl;
 document.querySelector('.brand').referrerPolicy='no-referrer';
 document.querySelector('.brand').rel='noreferrer noopener';
 const editUrl=new URL(publicUrl);editUrl.search='';editUrl.hash='';editUrl.searchParams.set('edit','1');
 const editLink=document.createElement('a');editLink.href=editUrl.href;editLink.textContent='Edit my journal';
 editLink.referrerPolicy='no-referrer';editLink.rel='noreferrer noopener';
 document.querySelector('footer').append(document.createTextNode(' '),editLink);
 window.addEventListener('pagehide',()=>cloud.disconnect());
 window.addEventListener('pageshow',e=>{if(e.persisted)load()});
 load();
})();
