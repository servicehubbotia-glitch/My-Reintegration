// Share a stable, read-only link that opens recorded work when available.
'use strict';
(()=>{
 const dialog=$('#accessManager'),error=$('#accessError');
 function shareUrl(){
  const url=new URL(window.MR_GOOGLE_CONFIG?.publicUrl||'https://servicehubbotia-glitch.github.io/My-Reintegration/');
  const dates=allDates(),start=monday(selected),end=plus(start,6);
  const sharedDate=dates.includes(selected)?selected:dates.find(d=>d>=start&&d<=end)||latestDate();
  url.searchParams.set('date',sharedDate);return url.href;
 }
 function open(){const url=shareUrl();$('#sharedViewUrl').value=url;$('#openSharedView').href=url;error.textContent='';dialog.showModal()}
 cloud.onStatus(()=>{$('#privateAccess').hidden=!canEdit()});
 $('#privateAccess').onclick=open;$('#shareView').onclick=open;
 $('#copyViewLink').onclick=async()=>{
  try{await navigator.clipboard.writeText($('#sharedViewUrl').value);error.textContent='Link copied. Anyone with the link can open this date.'}
  catch{$('#sharedViewUrl').select();error.textContent='The link is selected. Copy it from this field.'}
 };
})();
