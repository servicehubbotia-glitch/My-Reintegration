// Private read-only links are created by an authorized editor.
// Only a hash reaches the registry; the link itself lives in this signed-in page.
'use strict';
(()=>{
 const dialog=$('#accessManager'),error=$('#accessError');
 if(cloud.guest||cloud.demo){$('#shareView').hidden=true;$('#privateAccess').hidden=true;return}
 let identity='',newLink=null,busy=false;
 const editor=()=>['owner','editor'].includes(cloud.role);
 const publicUrl=window.MR_GOOGLE_CONFIG?.publicUrl||'https://servicehubbotia-glitch.github.io/My-Reintegration/';
 $('#publicDemoLink').href=publicUrl;
 function clearLink(){newLink=null;$('#sharedViewUrl').value='';$('#openSharedView').removeAttribute('href');$('#newPrivateLink').hidden=true}
 function accessUI(){
  if(identity!==cloud.identity||!editor()){clearLink();$('#privateLinkList').replaceChildren();identity=cloud.identity}
  $('#shareView').hidden=!editor();$('#privateAccess').hidden=!editor();
  $('#createPrivateLink').disabled=busy||!editor();$('#refreshPrivateLinks').disabled=busy||!editor();
 }
 cloud.onStatus(accessUI);accessUI();
 function renderLinks(grants){
  if(!Array.isArray(grants))throw Error('Private sharing is unavailable. Please try again later.');
  const list=$('#privateLinkList');list.replaceChildren();
  if(!grants.length){list.textContent='No private links have been created.';return}
  for(const grant of [...grants].reverse()){
   const row=document.createElement('div'),label=document.createElement('span');
   const expired=Date.parse(grant.expiresAt)<=Date.now();
   label.textContent=`Created ${new Date(grant.createdAt).toLocaleDateString('en-GB')} · ${grant.revokedAt?'Revoked':expired?'Expired':'Expires '+new Date(grant.expiresAt).toLocaleDateString('en-GB')} · ${grant.id.slice(-8)}`;
   row.appendChild(label);
   if(!grant.revokedAt){
    const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revoke';
    revoke.onclick=async()=>{
     if(!editor()||busy)return;
     if(!confirm('Revoke this private link? Anyone using it will need a new link. Your records will stay unchanged.'))return;
     await run(async()=>{const result=await cloud.manageAccess({operation:'revoke',id:grant.id});if(newLink?.id===grant.id)clearLink();renderLinks(result.grants);error.textContent='Private link revoked.'});
    };
    row.appendChild(revoke);
   }
   list.appendChild(row);
  }
 }
 async function run(action){
  if(!editor()||busy)return;
  busy=true;error.textContent='Working…';accessUI();
  try{await action()}catch(e){error.textContent=e.message||'Private sharing could not be updated.'}
  finally{busy=false;accessUI()}
 }
 async function list(){const result=await cloud.manageAccess({operation:'list'});renderLinks(result.grants);error.textContent=''}
 async function open(){
  if(!editor())return;
  if($('#preferences').open)$('#preferences').close();
  const today=new Date(),limit=new Date(Date.now()+365*86400000);
  $('#accessExpiry').min=iso(today);$('#accessExpiry').max=iso(limit);
  if(!$('#accessExpiry').value)$('#accessExpiry').value=iso(limit);
  dialog.showModal();await run(list);
 }
 $('#privateAccess').onclick=open;$('#shareView').onclick=open;
 $('#refreshPrivateLinks').onclick=()=>run(list);
 $('#createPrivateLink').onclick=()=>run(async()=>{
  const day=$('#accessExpiry').value;if(!validDate(day))throw Error('Choose a valid access expiry date.');
  const expiresAt=new Date(day+'T23:59:59.000Z').toISOString();
  if(Date.parse(expiresAt)<=Date.now()||Date.parse(expiresAt)>Date.now()+366*86400000)throw Error('Choose an expiry within the next year.');
  const url=new URL(window.MR_GOOGLE_CONFIG?.guestUrl||'');
  if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname))throw Error('Private sharing is not configured.');
  const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(token)))),b=>b.toString(16).padStart(2,'0')).join('');
  const id='read-'+crypto.randomUUID(),issuedFor=cloud.identity;
  const result=await cloud.manageAccess({operation:'create',id,digest,expiresAt});
  if(!editor()||cloud.identity!==issuedFor)return;
  renderLinks(result.grants);url.search='';url.hash=new URLSearchParams({access:token,date:selected}).toString();
  newLink={id,url:url.href};$('#sharedViewUrl').value=url.href;$('#openSharedView').href=url.href;$('#newPrivateLink').hidden=false;
  error.textContent='Private link created. Copy it and send it only to your intended reader.';
 });
 $('#copyViewLink').onclick=async()=>{
  if(!editor()||!newLink)return;
  try{await navigator.clipboard.writeText(newLink.url);error.textContent='Private link copied.'}
  catch{$('#sharedViewUrl').select();error.textContent='The private link is selected. Copy it from this field.'}
 };
})();
