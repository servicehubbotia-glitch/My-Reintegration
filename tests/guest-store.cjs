// Isolated credentials and transport; never contacts Google or the real spreadsheet.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const key='my-reintegration-guest-access-v1',token='t'.repeat(43);
const accepted={ok:true,identity:'isolated-grant',data:{activities:[{activity:'Isolated record'}]}};
function page(source,storage=new Map(),blocked=false){
 const requests=[],events={},window={addEventListener:(name,fn)=>events[name]=fn};
 const localStorage={getItem:k=>{if(blocked)throw Error('Storage blocked');return storage.get(k)||null},setItem:(k,v)=>{if(blocked)throw Error('Storage blocked');storage.set(k,v)},removeItem:k=>{if(blocked)throw Error('Storage blocked');storage.delete(k)}};
 const google={script:{get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),guestRequest:request=>requests.push({request,success,failure})};return api}}};
 vm.runInNewContext(source,{window,localStorage,google});
 return {cloud:window.JournalCloud,requests,events,storage};
}
async function suite(source){
 let p=page(source),pending=p.cloud.connect(token);p.requests.shift().success(accepted);await pending;
 assert.equal(p.cloud.role,'reader');assert.equal(p.storage.size,0);
 p.cloud.suspend();assert.equal(await page(source,p.storage).cloud.restore(),null);

 p=page(source);pending=p.cloud.connect(token,{remember:true});
 assert.equal(p.storage.size,0,'Do not remember an unverified credential');
 p.requests.shift().success(accepted);await pending;assert.equal(p.cloud.remembered,true);
 assert.deepEqual([...p.storage],[[key,token]],'Persist only the opted-in credential, never journal data');
 p.cloud.suspend();assert.equal(p.cloud.role,'');assert.equal(p.storage.get(key),token);
 let next=page(source,p.storage);pending=next.cloud.restore();
 assert.equal(next.cloud.role,'','Restoration must await fresh server authorization');
 assert.equal(next.requests[0].request.token,token);next.requests.shift().success(accepted);await pending;
 assert.equal(next.cloud.role,'reader');assert.equal(next.cloud.remembered,true);

 // A transient error clears displayed access while retaining an opted-in credential for retry.
 pending=next.cloud.refresh();next.requests.shift().failure();await assert.rejects(pending,/Connection error/);
 assert.equal(next.cloud.role,'');assert.equal(p.storage.get(key),token);
 next=page(source,p.storage);pending=next.cloud.restore();next.requests.shift().success({ok:false,code:'BUSY',message:'Please try again.'});await assert.rejects(pending);
 assert.equal(next.cloud.role,'');assert.equal(p.storage.get(key),token);

 // Expiry/revocation is checked by Google on restoration and removes the remembered credential.
 next=page(source,p.storage);pending=next.cloud.restore();next.requests.shift().success({ok:false,code:'FORBIDDEN',message:'Access is invalid, expired or revoked.'});await assert.rejects(pending);
 assert.equal(next.cloud.role,'');assert.equal(p.storage.size,0);
 next=page(source,p.storage);pending=next.cloud.connect(token,{remember:true});next.requests.shift().success(accepted);await pending;
 next.cloud.disconnect();assert.equal(p.storage.size,0);assert.equal(next.cloud.role,'');

 // Signing out before an in-flight success cannot persist a credential or restore the session.
 pending=next.cloud.connect(token,{remember:true});next.cloud.disconnect();next.requests.shift().success(accepted);await assert.rejects(pending,/Session ended/);
 assert.equal(p.storage.size,0);assert.equal(next.cloud.role,'');
 pending=next.cloud.connect(token,{remember:true});const stale=next.requests.shift();const fresh=next.cloud.connect(token,{remember:true});next.requests.shift().success(accepted);await fresh;
 stale.failure();await assert.rejects(pending);assert.equal(next.cloud.role,'reader');
 p.storage.delete(key);next.events.storage({key,newValue:null});assert.equal(next.cloud.role,'');

 // Storage restrictions preserve ordinary session-only access.
 p=page(source,new Map(),true);assert.equal(await p.cloud.restore(),null);
 pending=p.cloud.connect(token,{remember:true});p.requests.shift().success(accepted);await pending;
 assert.equal(p.cloud.role,'reader');assert.equal(p.cloud.remembered,false);
}
(async()=>{
 await suite(fs.readFileSync('guest-store.js','utf8'));
 const inline=[...fs.readFileSync('apps-script-guest/View.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.JournalCloud='));
 assert.ok(inline);await suite(inline);
 console.log('PASS guest storage: opt-in, fresh authorization after reload, expiry/revocation, sign-out, transient failures, stale callbacks, cross-tab sign-out and blocked storage');
})().catch(e=>{console.error(e);process.exitCode=1});
