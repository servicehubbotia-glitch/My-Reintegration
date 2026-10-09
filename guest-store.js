// HTMLService transport: bearer credential stays in this closure, never a URL or storage.
'use strict';
window.JournalCloud=(()=>{
 let token='',role='',identity='',epoch=0;
 const listeners=new Set();
 function signal(status,message=''){listeners.forEach(f=>f({status,message,role,identity,pending:false}))}
 function disconnect(){epoch++;token='';role='';identity='';signal('Enter access token')}
 function request(operation='read',week){
  const version=epoch;
  return new Promise((resolve,reject)=>{
   if(!token)return reject(Error('Enter your access token.'));
   google.script.run.withSuccessHandler(r=>{
    if(version!==epoch)return reject(Error('Session ended.'));
    if(!r?.ok){disconnect();return reject(Error(r?.message||'Access denied.'))}
    role='reader';identity=r.identity;signal('Read-only access');resolve(r.data);
   }).withFailureHandler(()=>{disconnect();reject(Error('Connection error. Please enter your token again.'))}).guestRequest({token,operation,week});
  });
 }
 async function connect(value){disconnect();token=typeof value==='string'?value.trim():'';return request()}
 const forbidden=async()=>{throw Error('Read-only access. Changes are not permitted.')};
 return {guest:true,connect,disconnect,refresh:()=>request(),authorizedRead:request,commit:forbidden,retry:forbidden,onStatus:f=>listeners.add(f),get role(){return role},get identity(){return identity},get hasPending(){return false},get pendingBackup(){return null},discardPending:forbidden};
})();
