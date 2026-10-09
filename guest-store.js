// The owner enables this separate, read-only view for anyone with its link.
'use strict';
window.JournalCloud=(()=>{
 let role='',identity='',epoch=0;
 const listeners=new Set();
 // Retire credentials remembered by earlier versions of this view.
 try{localStorage.removeItem('my-reintegration-guest-access-v1')}catch{}
 function signal(status){listeners.forEach(f=>f({status,message:'',role,identity,pending:false}))}
 function disconnect(){epoch++;role='';identity=''}
 function request(operation='read',week){
  const version=epoch;
  return new Promise((resolve,reject)=>{
   google.script.run.withSuccessHandler(r=>{
    if(version!==epoch)return reject(Error('View closed.'));
    if(!r?.ok){disconnect();signal('Journal unavailable');return reject(Error(r?.message||'Please try Refresh.'))}
    role='reader';identity='link-reader';signal('Read-only view');resolve(r.data);
   }).withFailureHandler(()=>{if(version===epoch){disconnect();signal('Connection error')}reject(Error('Connection error. Please try Refresh.'))}).guestRequest({operation,week});
  });
 }
 const forbidden=async()=>{throw Error('Read-only view. Changes are not permitted.')};
 return {guest:true,publicLink:true,connect:()=>request(),disconnect,refresh:()=>request(),authorizedRead:request,commit:forbidden,retry:forbidden,onStatus:f=>listeners.add(f),get role(){return role},get identity(){return identity},get hasPending(){return false},get pendingBackup(){return null},discardPending:forbidden};
})();
