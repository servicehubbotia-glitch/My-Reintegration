// Public read-only transport. No credentials or journal records are persisted.
'use strict';
(()=>{
 const legacy=typeof google!=='undefined'&&!!google.script;
 // The legacy Apps Script View has no configuration script and uses google.script.run.
 // On GitHub Pages both transports are loaded, but only the selected one is installed.
 if(window.MR_PUBLIC_MODE===false)return;
 window.JournalCloud=(()=>{
  const operations=new Set(['read','report','export.pdf','export.xlsx','export.csv','export.copy']);
  const timeoutMs=20000,retryDelayMs=600;
  let role='',identity='',epoch=0,sequence=0,loading=false,lastError='',status='Loading journal…';
  const listeners=new Set(),inflight=new Map(),cancellations=new Set();
  try{localStorage.removeItem('my-reintegration-guest-access-v1')}catch{}
  if(typeof document!=='undefined')document.body?.classList.add('guest-view');
  function event(){return {status,message:lastError,role,identity,pending:false,loading}}
  function signal(next,message=''){status=next;lastError=message;listeners.forEach(f=>f(event()))}
  function failure(code,message,retryable=false){const e=Error(message);e.code=code;e.retryable=retryable;return e}
  const closed=()=>failure('CLOSED','View closed.');
  function disconnect(){
   epoch++;role='';identity='';loading=false;lastError='';
   for(const cancel of [...cancellations])cancel();
   inflight.clear();signal('View closed');
  }
  function transport(request){
   return new Promise((resolve,reject)=>{
    let settled=false,script=null,callback='',timer;
    const cancel=()=>finish(closed());
    function finish(error,result){
     if(settled)return;
     settled=true;clearTimeout(timer);cancellations.delete(cancel);
     if(script){script.onerror=null;script.onload=null;script.remove()}
     if(callback)delete window[callback];
     error?reject(error):resolve(result);
    }
    cancellations.add(cancel);
    timer=setTimeout(()=>finish(failure('TIMEOUT','The journal did not respond. Please try Refresh.',true)),timeoutMs);
    try{
     if(legacy){
      google.script.run.withSuccessHandler(r=>finish(null,r))
       .withFailureHandler(()=>finish(failure('CONNECTION','Connection error. Please try Refresh.',true)))
       .guestRequest(request);
      return;
     }
     let endpoint;
     try{endpoint=new URL(window.MR_GOOGLE_CONFIG?.guestUrl||'')}
     catch{throw failure('SETUP_REQUIRED','The journal connection is not configured.')}
     if(endpoint.origin!=='https://script.google.com'||!/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(endpoint.pathname))
      throw failure('SETUP_REQUIRED','The journal connection is not configured.');
     callback='MR_read_'+Date.now().toString(36)+'_'+(++sequence).toString(36)+'_'+Math.random().toString(36).slice(2,10);
     endpoint.search='';endpoint.hash='';
     endpoint.searchParams.set('callback',callback);
     endpoint.searchParams.set('operation',request.operation);
     if(request.week)endpoint.searchParams.set('week',request.week);
     window[callback]=r=>finish(null,r);
     script=document.createElement('script');script.async=true;script.referrerPolicy='no-referrer';
     script.src=endpoint.href;
     script.onerror=()=>finish(failure('CONNECTION','Connection error. Please try Refresh.',true));
     script.onload=()=>finish(failure('INVALID_RESPONSE','The journal could not load its data. Please try Refresh.'));
     (document.head||document.documentElement).appendChild(script);
    }catch(e){finish(e.code?e:failure('CONNECTION','Connection error. Please try Refresh.',true))}
   });
  }
  function checked(response){
   if(response?.ok===false)throw failure(response.code||'SERVICE_ERROR',response.message||'The journal is unavailable. Please try Refresh.',response.code==='BUSY');
   const data=response?.data;
   if(response?.ok!==true||data?.version!==1||!data.settings||!Array.isArray(data.activities)||!Array.isArray(data.applications))
    throw failure('INVALID_RESPONSE','The journal could not load its data. Please try Refresh.');
   return data;
  }
  function request(operation='read',week){
   if(!operations.has(operation))return Promise.reject(failure('FORBIDDEN','Read-only view. Changes are not permitted.'));
   if((week!==undefined&&(typeof week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week)))
    ||(operation!=='read'&&week===undefined))
    return Promise.reject(failure('INVALID','Choose a valid report week before requesting data.'));
   // Public results are limited to a single week; an unscoped read selects the latest week.
   const key=operation+':'+(week||'latest');
   if(inflight.has(key))return inflight.get(key);
   const version=epoch;
   loading=true;signal(role?'Refreshing…':'Loading journal…');
   const work=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
     if(version!==epoch)throw closed();
     try{
      const data=checked(await transport({operation,week}));
      if(version!==epoch)throw closed();
      role='reader';identity='link-reader';signal('Read-only view');return data;
     }catch(e){
      if(version!==epoch||e.code==='CLOSED')throw closed();
      if(attempt===0&&e.retryable){
       signal('Reconnecting…');await new Promise(resolve=>setTimeout(resolve,retryDelayMs));continue;
      }
      role='';identity='';signal('Connection error',e.message);throw e;
     }
    }
   })().finally(()=>{
    if(inflight.get(key)===work)inflight.delete(key);
    if(version===epoch){loading=inflight.size>0;listeners.forEach(f=>f(event()))}
   });
   inflight.set(key,work);return work;
  }
  const forbidden=async()=>{throw failure('FORBIDDEN','Read-only view. Changes are not permitted.')};
  return {guest:true,publicLink:true,connect:()=>request(),disconnect,refresh:()=>request(),authorizedRead:request,
   commit:forbidden,retry:forbidden,discardPending:forbidden,
   onStatus:f=>{listeners.add(f);f(event());return()=>listeners.delete(f)},
   get role(){return role},get identity(){return identity},get hasPending(){return false},get pendingBackup(){return null},
   get loading(){return loading},get lastError(){return lastError},get status(){return status}};
 })();
})();
