// HTMLService transport. Remembering access is opt-in; records are never cached here.
'use strict';
window.JournalCloud=(()=>{
 const STORAGE_KEY='my-reintegration-guest-access-v1';
 let token='',role='',identity='',epoch=0,remembered=false;
 const listeners=new Set();
 function stored(){try{return localStorage.getItem(STORAGE_KEY)||''}catch{return ''}}
 function forget(){try{localStorage.removeItem(STORAGE_KEY)}catch{}}
 function signal(status,message=''){listeners.forEach(f=>f({status,message,role,identity,pending:false}))}
 function disconnect({forgetDevice=true}={}){epoch++;token='';role='';identity='';remembered=false;if(forgetDevice)forget();signal('Enter access token')}
 function request(operation='read',week){
  const version=epoch;
  return new Promise((resolve,reject)=>{
   if(!token)return reject(Error('Enter your access token.'));
   google.script.run.withSuccessHandler(r=>{
    if(version!==epoch)return reject(Error('Session ended.'));
    if(!r?.ok){disconnect({forgetDevice:r?.code==='FORBIDDEN'});return reject(Error(r?.message||'Access denied.'))}
    role='reader';identity=r.identity;signal('Read-only access');resolve(r.data);
   }).withFailureHandler(()=>{if(version===epoch)disconnect({forgetDevice:false});reject(Error('Connection error. Please reopen this page to try again.'))}).guestRequest({token,operation,week});
  });
 }
 async function start(value,remember,restoring=false){
  disconnect({forgetDevice:!restoring});token=typeof value==='string'?value.trim():'';const version=epoch;
  const data=await request();if(version!==epoch)throw Error('Session ended.');
  if(remember){try{localStorage.setItem(STORAGE_KEY,token);remembered=stored()===token}catch{remembered=false}}
  return data;
 }
 const connect=(value,{remember=false}={})=>start(value,remember);
 async function restore(){const value=stored();return value?start(value,true,true):null}
 // Signing out in another tab also clears this tab's displayed session.
 window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY&&remembered)disconnect({forgetDevice:false})});
 const forbidden=async()=>{throw Error('Read-only access. Changes are not permitted.')};
 return {guest:true,connect,restore,disconnect,suspend:()=>disconnect({forgetDevice:false}),refresh:()=>request(),authorizedRead:request,commit:forbidden,retry:forbidden,onStatus:f=>listeners.add(f),get remembered(){return remembered},get role(){return role},get identity(){return identity},get hasPending(){return false},get pendingBackup(){return null},discardPending:forbidden};
})();
