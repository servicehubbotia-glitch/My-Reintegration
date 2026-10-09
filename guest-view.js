// Reuse the journal interface and exporters. Each view/export refresh requires server authorization.
'use strict';
(()=>{
 document.body.classList.add('guest-view');
 $('#connect').onclick=()=>{$('#rememberAccess').checked=cloud.remembered;$('#guestLogin').showModal()};
 const clear=()=>{state=empty();$('#reportText').textContent='';for(const id of ['emailTo','emailSubject','emailBody'])$('#'+id).value='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());render()};
 cloud.onStatus(event=>{if(!event.role)clear()});
 $('#guestLoginForm').onsubmit=async e=>{
  e.preventDefault();const input=$('#accessToken'),remember=$('#rememberAccess').checked;let value=input.value;input.value='';$('#guestLogin').close();
  try{const promise=cloud.connect(value,{remember});value='';state=validate(await promise);render();toast(remember?(cloud.remembered?'Access remembered on this device.':'Connected for this visit. Your browser could not remember access.'):'Connected with read-only access.')}
  catch(e){clear();toast(e.message)}
 };
 $('#signout').onclick=()=>{cloud.disconnect();clear();toast('Signed out. This device has forgotten your access.')};
 async function authorized(operation,handler,event){
  try{state=validate(await cloud.authorizedRead(operation,week));render();return await handler?.(event)}catch(e){if(!cloud.role)clear();toast(e.message)}
 }
 for(const id of ['prev','next','today','activityTab','applicationTab','days']){const handler=$('#'+id).onclick;$('#'+id).onclick=e=>authorized('read',handler,e)}
 const change=$('#jump').onchange;$('#jump').onchange=e=>authorized('read',change,e);
 for(const [id,operation] of [['report','report'],['pdf','export.pdf'],['excel','export.xlsx'],['csv','export.csv'],['copy','export.copy']]){
  const handler=$('#'+id).onclick;$('#'+id).onclick=e=>authorized(operation,handler,e);
 }
 $('#refresh').onclick=()=>authorized('read');
 $('#connect').textContent='Enter access token';
 document.querySelector('footer').textContent='Private read-only access. Choose “Remember access on this device” to return without entering your token. Signing out forgets it. Access still expires or can be revoked by the owner. Downloaded reports remain on your device.';
 cloud.onStatus(()=>{$('#connect').textContent='Enter access token'});
 async function restore(){try{const data=await cloud.restore();if(data){state=validate(data);render()}}catch(e){clear();toast(e.message)}}
 window.addEventListener('pagehide',()=>{cloud.suspend();clear()});
 window.addEventListener('pageshow',e=>{if(e.persisted)restore()});
 setInterval(()=>{if(cloud.role)authorized('read')},15000);
 restore();
})();
