// Owner-only control; the server independently checks the Google account on every call.
'use strict';
(()=>{
 const dialog=$('#accessManager'),error=$('#accessError');
 cloud.onStatus(()=>{$('#privateAccess').hidden=cloud.role!=='owner'});
 function list(grants){$('#accessList').replaceChildren();for(const g of grants){const row=document.createElement('p'),button=document.createElement('button');row.textContent=`${g.id} · Expires ${new Date(g.expiresAt).toLocaleString()} · ${g.revokedAt?'Revoked':Date.parse(g.expiresAt)<=Date.now()?'Expired':'Active'} `;button.textContent='Revoke';button.disabled=!!g.revokedAt;button.onclick=async()=>{try{button.disabled=true;list((await cloud.manageAccess({operation:'revoke',id:g.id})).grants)}catch(e){error.textContent=e.message;button.disabled=false}};row.append(button);$('#accessList').append(row)}}
 $('#privateAccess').onclick=async()=>{dialog.showModal();error.textContent='Loading…';try{list((await cloud.manageAccess({operation:'list'})).grants);error.textContent=''}catch(e){error.textContent=e.message}};
 $('#accessCreate').onsubmit=async e=>{
  e.preventDefault();if(cloud.role!=='owner')return;const button=e.submitter;button.disabled=true;error.textContent='Creating access…';$('#issuedToken').value='';$('#issuedAccess').hidden=true;
  let token='';
  try{
   const bytes=crypto.getRandomValues(new Uint8Array(32));token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(token)))),b=>b.toString(16).padStart(2,'0')).join('');
   const result=await cloud.manageAccess({operation:'create',id:crypto.randomUUID(),digest,expiresAt:new Date(Date.now()+Number($('#accessDays').value)*86400000).toISOString()});
   list(result.grants);if(dialog.open){$('#issuedToken').value=token;$('#issuedAccess').hidden=false;error.textContent='Access created. Copy the token and share it privately.'}else error.textContent='';
  }catch(e){error.textContent=e.message}finally{token='';button.disabled=false}
 };
 dialog.addEventListener('close',()=>{$('#issuedToken').value='';$('#issuedAccess').hidden=true});
 cloud.onStatus(e=>{if(e.role!=='owner')dialog.close()});
})();
