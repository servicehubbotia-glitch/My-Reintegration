// Share a stable, read-only link that preserves the selected date.
'use strict';
(()=>{
 const dialog=$('#accessManager'),error=$('#accessError');
 function shareUrl(){
  const url=new URL(window.MR_GOOGLE_CONFIG?.publicUrl||'https://servicehubbotia-glitch.github.io/My-Reintegration/');
  url.searchParams.set('date',selected);return url.href;
 }
 function open(){const url=shareUrl();$('#sharedViewUrl').value=url;$('#openSharedView').href=url;error.textContent='';dialog.showModal()}
 cloud.onStatus(()=>{$('#privateAccess').hidden=cloud.role!=='owner'});
 $('#privateAccess').onclick=open;$('#shareView').onclick=open;
 $('#copyViewLink').onclick=async()=>{
  try{await navigator.clipboard.writeText($('#sharedViewUrl').value);error.textContent='Link copied. Anyone with the link can open this date.'}
  catch{$('#sharedViewUrl').select();error.textContent='The link is selected. Copy it from this field.'}
 };
})();
