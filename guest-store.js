// Private read-only transport. Tokens and journal records are never persisted.
'use strict';
(()=>{
 const legacy=typeof google!=='undefined'&&!!google.script;
 // The Apps Script View has no configuration script. Demo and editor pages install
 // their own store. Real records are available only through HTMLService's RPC.
 if(window.MR_MODE!==undefined?window.MR_MODE!=='reader':window.MR_PUBLIC_MODE===false)return;
 window.JournalCloud=(()=>{
  const operations=new Set(['read','report','export.pdf','export.xlsx','export.csv','export.copy']);
  const timeoutMs=20000,retryDelayMs=600;
  const accessMessage='This private link is invalid, expired or revoked. Ask the journal owner for a new private link.';
  const setupMessage='Open the private journal link provided by the owner to view personal records.';
  let role='',identity='',epoch=0,loading=false,lastError='',status='Loading journal…',initialDate='',initialWeek='';
  const listeners=new Set(),inflight=new Map(),cancellations=new Set();
  try{localStorage.removeItem('my-reintegration-guest-access-v1')}catch{}
  if(typeof document!=='undefined')document.body?.classList.add('guest-view');
  function event(){return {status,message:lastError,role,identity,pending:false,loading}}
  function signal(next,message=''){status=next;lastError=message;listeners.forEach(f=>f(event()))}
  function failure(code,message,retryable=false){const e=Error(message);e.code=code;e.retryable=retryable;return e}
  const closed=()=>failure('CLOSED','View closed.');
  function reset(next,message=''){
   epoch++;role='';identity='';loading=false;
   for(const cancel of [...cancellations])cancel();
   inflight.clear();signal(next,message);
  }
  function disconnect(){reset('View closed')}
  function fragmentToken(hash){
   if(typeof hash!=='string'||hash.length>512)throw failure('FORBIDDEN',accessMessage);
   const values=new URLSearchParams(hash.replace(/^#/,'')).getAll('access');
   if(values.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(values[0]))throw failure('FORBIDDEN',accessMessage);
   return values[0];
  }
  function locationDate(location,key){
   const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
    &&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
   const fragments=new URLSearchParams(location.hash.replace(/^#/,'')).getAll(key);
   if(fragments.length)return fragments.length===1&&valid(fragments[0])?fragments[0]:'';
   const value=location?.parameter?.[key];
   return valid(value)
    &&(!location.parameters?.[key]||location.parameters[key].length===1)?value:'';
  }
  function transport(operation,week){
   return new Promise((resolve,reject)=>{
    let settled=false,timer;
    const cancel=()=>finish(closed());
    function finish(error,result){
     if(settled)return;
     settled=true;clearTimeout(timer);cancellations.delete(cancel);
     error?reject(error):resolve(result);
    }
    try{
     if(!legacy||typeof google.script.url?.getLocation!=='function'||!google.script.run)
      throw failure('SETUP_REQUIRED',setupMessage);
     cancellations.add(cancel);
     timer=setTimeout(()=>finish(failure('TIMEOUT','The journal did not respond. Please try Refresh.',true)),timeoutMs);
     // An HTMLService iframe cannot read the address bar directly. This API reads
     // its fragment without sending the credential as an application query string.
     google.script.url.getLocation(location=>{
      if(settled)return;
      try{
       const token=fragmentToken(location?.hash);
       initialDate=locationDate(location,'date');initialWeek=locationDate(location,'week');
       google.script.run.withSuccessHandler(r=>finish(null,r))
        .withFailureHandler(()=>finish(failure('CONNECTION','Connection error. Please try Refresh.',true)))
        .guestRequest({token,operation,week});
      }catch(e){finish(e.code==='FORBIDDEN'?failure('FORBIDDEN',accessMessage):failure('CONNECTION','Connection error. Please try Refresh.',true))}
     });
    }catch(e){finish(e.code==='SETUP_REQUIRED'?failure('SETUP_REQUIRED',setupMessage):failure('CONNECTION','Connection error. Please try Refresh.',true))}
   });
  }
  function checked(response){
   // Do not echo arbitrary service messages or identifiers into the UI.
   if(response?.ok===false){
    if(response.code==='FORBIDDEN')throw failure('FORBIDDEN',accessMessage);
    if(response.code==='BUSY')throw failure('BUSY','The journal is busy. Please try Refresh.',true);
    throw failure('SERVICE_ERROR','The journal is unavailable. Please try Refresh.');
   }
   const data=response?.data;
   if(response?.ok!==true||response.role!=='reader'||data?.version!==1||!data.settings||!Array.isArray(data.activities)||!Array.isArray(data.applications))
    throw failure('INVALID_RESPONSE','The journal could not load its data. Please try Refresh.');
   return data;
  }
  function retryDelay(){
   return new Promise((resolve,reject)=>{
    const cancel=()=>{clearTimeout(timer);cancellations.delete(cancel);reject(closed())};
    const timer=setTimeout(()=>{cancellations.delete(cancel);resolve()},retryDelayMs);
    cancellations.add(cancel);
   });
  }
  function request(operation='read',week){
   if(!operations.has(operation))return Promise.reject(failure('FORBIDDEN','Read-only view. Changes are not permitted.'));
   if(operation!=='read'&&(typeof week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week)))
    return Promise.reject(failure('INVALID','Choose a report week before downloading.'));
   // A read always returns the complete snapshot, so navigation and refresh can share it.
   const key=operation==='read'?'read':operation+':'+week;
   if(inflight.has(key))return inflight.get(key);
   const version=epoch;
   loading=true;signal(role?'Refreshing…':'Loading journal…');
   const work=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
     if(version!==epoch)throw closed();
     try{
      const data=checked(await transport(operation,week));
      if(version!==epoch)throw closed();
      role='reader';identity='link-reader';signal('Read-only view');return data;
     }catch(e){
      if(version!==epoch||e.code==='CLOSED')throw closed();
      if(attempt===0&&e.retryable){
       signal('Reconnecting…');await retryDelay();continue;
      }
      reset(e.code==='FORBIDDEN'?'Access unavailable':'Connection error',e.message);throw e;
     }
    }
   })().finally(()=>{
    if(inflight.get(key)===work)inflight.delete(key);
    if(version===epoch){loading=inflight.size>0;listeners.forEach(f=>f(event()))}
   });
   inflight.set(key,work);return work;
  }
  const forbidden=async()=>{throw failure('FORBIDDEN','Read-only view. Changes are not permitted.')};
  return {guest:true,publicLink:true,privateLink:true,connect:()=>request(),disconnect,refresh:()=>request(),authorizedRead:request,
   commit:forbidden,retry:forbidden,discardPending:forbidden,
   onStatus:f=>{listeners.add(f);f(event());return()=>listeners.delete(f)},
   get role(){return role},get identity(){return identity},get hasPending(){return false},get pendingBackup(){return null},
   get loading(){return loading},get lastError(){return lastError},get status(){return status},
   get initialDate(){return initialDate},get initialWeek(){return initialWeek}};
 })();
})();
