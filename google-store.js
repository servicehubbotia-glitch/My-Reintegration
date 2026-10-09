'use strict';
// OAuth access tokens exist only inside this closure, never in browser storage.
window.JournalCloud = (() => {
 const scope='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email';
 let token='',expires=0,identity='',role='',revision='',current=null,pending=null,busy=false;
 const listeners=new Set();
 const signal=(status,message='')=>listeners.forEach(f=>f({status,message,role,identity,pending:!!pending}));
 const config=()=>window.MR_GOOGLE_CONFIG||{};
 const recoveryKey=()=> 'my-reintegration-pending-v2:'+encodeURIComponent(identity);
 function failure(code,message){const e=new Error(message);e.code=code;return e}
 async function call(request){
  if(!token||Date.now()>=expires)throw failure('AUTH','Sign in with Google to continue. Pending changes are retained.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const r=await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(config().deploymentId)}:run`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({function:'journal',parameters:[request],devMode:false}),signal:controller.signal});
   const result=await r.json();
   if(!r.ok||result.error)throw failure(r.status===401?'AUTH':'SERVICE_ERROR',result.error?.details?.[0]?.errorMessage||result.error?.message||'Google could not complete this request.');
   const out=result.response?.result;if(!out?.ok)throw failure(out?.code||'SERVICE_ERROR',out?.message||'Google did not confirm the operation.');
   return out;
  }catch(e){if(e.name==='AbortError')throw failure('CONNECTION','The save confirmation timed out. Retry safely with the same request.');throw e}finally{clearTimeout(timeout)}
 }
 function accept(r){identity=r.identity;role=r.role;revision=r.revision;current=r.data;return structuredClone(current)}
 function persistPending(p){localStorage.setItem(recoveryKey(),JSON.stringify(p));pending=p}
 function clearPending(){localStorage.removeItem(recoveryKey());pending=null}
 function restorePending(){try{pending=JSON.parse(localStorage.getItem(recoveryKey())||'null');if(pending&&pending.identity!==identity)throw Error('Wrong recovery account.')}catch(e){throw failure('RECOVERY','Recovery data could not be read. Export it before continuing.')}}
 function connect(){
  return new Promise((resolve,reject)=>{
   if(!config().clientId||!config().deploymentId){reject(failure('SETUP_REQUIRED','Google connection awaits owner authorization and deployment. Existing local records remain untouched.'));return}
   if(!window.google?.accounts?.oauth2){reject(failure('CONNECTION','Google sign-in did not load. Check your connection.'));return}
   const client=google.accounts.oauth2.initTokenClient({client_id:config().clientId,scope,callback:async r=>{
    if(r.error){reject(failure('AUTH',r.error_description||r.error));return}
    token=r.access_token;expires=Date.now()+Number(r.expires_in)*1000-30000;
    try{const out=await call({action:'read'});accept(out);restorePending();signal(pending?'Unsaved changes':'Saved');resolve(structuredClone(current))}catch(e){token='';role='';current=null;signal('Connection error',e.message);reject(e)}
   },error_callback:e=>reject(failure('AUTH',e.type||'Google sign-in was cancelled.'))});
   client.requestAccessToken({prompt:'select_account'});
  });
 }
 const cleanRecord=r=>Object.fromEntries(Object.entries(r||{}).filter(([k])=>!['createdAt','updatedAt','_row'].includes(k)).sort(([a],[b])=>a.localeCompare(b)));
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function changes(base,next){const mutations=[];for(const kind of ['activities','applications']){
  for(const r of next[kind]){const prior=base[kind].find(x=>x.id===r.id);if(!same(cleanRecord(prior),cleanRecord(r)))mutations.push({type:'put',kind,record:cleanRecord(r)})}
  for(const r of base[kind])if(!next[kind].some(x=>x.id===r.id))mutations.push({type:'delete',kind,id:r.id});
 }if(!same(base.settings,next.settings))mutations.push({type:'settings',settings:next.settings});return mutations}
 async function commit(next){
  if(role!=='owner')throw failure('FORBIDDEN','Sign in as the owner to make changes.');
  if(busy)throw failure('BUSY','A save is already in progress.');
  if(pending)throw failure('PENDING','Resolve the pending save before adding another change.');
  const mutations=changes(current,next);if(!mutations.length)return structuredClone(current);
  if(mutations.length>50)throw failure('LIMIT','Save at most 50 changes in one batch.');
  persistPending({identity,base:current,desired:next,request:{action:'commit',revision,requestId:crypto.randomUUID(),mutations}});
  return retry();
 }
 async function retry(){
  if(!pending) return structuredClone(current);
  if(role!=='owner')throw failure('FORBIDDEN','This account cannot write records.');
  if(busy)throw failure('BUSY','A save is already in progress.');
  busy=true;signal('Saving…');
  try{const r=await call(pending.request);const data=accept(r);clearPending();signal('Saved');return data}
  catch(e){signal('Connection error',e.message);throw e}finally{busy=false}
 }
 async function refresh(){if(busy)throw failure('BUSY','A save is in progress.');const r=await call({action:'read'});const data=accept(r);signal(pending?'Unsaved changes':'Saved');return data}
 function disconnect(){token='';expires=0;identity='';role='';revision='';current=null;pending=null;signal('Sign in to Google')}
 function discardPending(){if(busy)throw failure('BUSY','Wait for the save to finish.');clearPending();signal('Saved')}
 return {manageAccess:request=>call({action:'access',...request}),connect,commit,retry,refresh,disconnect,changes,onStatus:f=>listeners.add(f),get role(){return role},get identity(){return identity},get hasPending(){return !!pending},get pendingBackup(){return pending?structuredClone(pending):null},discardPending};
})();
