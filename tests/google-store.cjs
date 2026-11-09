// Client recovery tests with isolated OAuth/fetch/storage doubles. No Google requests.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('google-store.js','utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const canonical=record=>record==null?null:Object.fromEntries(Object.entries(record).filter(([k])=>!['createdAt','updatedAt','_row'].includes(k)).sort(([a],[b])=>a.localeCompare(b)));
const activity=(id='activity-0001',extra={})=>({id,date:'2026-11-06',activity:'Recorded work',category:'Other',outcome:'Original outcome',completed:'Yes',minutes:60,mail:'No',createdAt:'2026-11-06T10:00:00Z',updatedAt:'2026-11-06T10:00:00Z',...extra});
const application=()=>({id:'application-0001',date:'2026-11-06',function:'Example role',company:'Example company',via:'Website',conversation:'',interview:'',withWhom:'',phone:'',result:'Pending'});
const data=()=>({version:1,settings:{goal:20,recipient:'',name:'Example'},activities:[activity()],applications:[]});
const changed=base=>{const next=clone(base);next.activities[0].outcome='My pending outcome';return next};
const conflict=()=>({ok:false,code:'CONFLICT',message:'Records changed.'});
function memory(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}}
function legacy(base,desired,mutations=[{type:'put',kind:'activities',record:canonical(desired.activities[0])}]){
 return {identity:'editor@example.invalid',base:clone(base),desired:clone(desired),request:{action:'commit',revision:'r1',requestId:'legacy-request-0001',mutations:clone(mutations)}};
}
function setup({identity='editor@example.invalid',role='editor',storage=memory(),respond}={}){
 const h={identity,role,storage,calls:[],events:[],key:'my-reintegration-pending-v2:'+encodeURIComponent(identity)};let sequence=0;
 h.reply=(records,revision='r1',extra={})=>({ok:true,identity,role,revision,data:clone(records),...extra});
 const google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>void options.callback({access_token:'isolated-token',expires_in:3600})})}}};
 const window={MR_PUBLIC_MODE:false,MR_GOOGLE_CONFIG:{clientId:'isolated-client',deploymentId:'isolated-deployment'},google};
 const context={window,google,localStorage:storage,structuredClone,AbortController,setTimeout,clearTimeout,crypto:{randomUUID:()=>`fresh-request-${++sequence}`},
  fetch:async(url,options)=>{assert.match(url,/^https:\/\/script\.googleapis\.com\/v1\/scripts\/isolated-deployment:run$/);const body=JSON.parse(options.body);assert.equal(body.function,'journal');const request=clone(body.parameters[0]);h.calls.push(request);const result=await respond(request,h);return {ok:true,status:200,json:async()=>({response:{result}})}}};
 vm.runInNewContext(source,context);h.cloud=window.JournalCloud;h.cloud.onStatus(event=>h.events.push(clone(event)));return h;
}
async function editorContract(){
 const base=data();base.applications=[application()];const next=changed(base);next.activities.push(activity('activity-0002'));next.applications=[];next.settings.goal=18;
 const h=setup({respond:(request,ctx)=>request.action==='read'?ctx.reply(base):ctx.reply(next,'r2')});
 await h.cloud.connect();assert.equal(h.cloud.role,'editor');await h.cloud.commit(next);
 const sent=h.calls[1];assert.equal(sent.revision,'r1');assert.equal(sent.mutations.length,4);
 const edit=sent.mutations.find(m=>m.type==='put'&&m.record.id==='activity-0001');assert.deepEqual(edit.before,canonical(base.activities[0]));assert.ok(!('updatedAt' in edit.record));
 assert.equal(sent.mutations.find(m=>m.type==='put'&&m.record.id==='activity-0002').before,null);
 assert.deepEqual(sent.mutations.find(m=>m.type==='delete').before,canonical(base.applications[0]));
 assert.deepEqual(sent.mutations.find(m=>m.type==='settings').before,base.settings);
 assert.equal(h.cloud.hasPending,false);assert.equal(h.storage.getItem(h.key),null);
 const reordered={...base,settings:{name:'Example',recipient:'',goal:20}};assert.equal(h.cloud.changes(base,reordered).length,0);
 for(const role of ['owner','reader']){
  const other=setup({identity:role+'@example.invalid',role,respond:(request,ctx)=>ctx.reply(request.action==='read'?base:next)});await other.cloud.connect();
  if(role==='owner')await other.cloud.commit(next);else {await assert.rejects(other.cloud.commit(next),e=>e.code==='FORBIDDEN');assert.equal(other.calls.length,1)}
 }
}
async function legacyDisjoint(){
 const base=data(),desired=changed(base),saved=legacy(base,desired),fresh=clone(base);fresh.activities[0].updatedAt='2026-11-09T10:00:00Z';fresh.activities.push(activity('external-0001'));fresh.applications.push(application());
 const storage=memory();storage.setItem('my-reintegration-pending-v2:editor%40example.invalid',JSON.stringify(saved));let commits=0;
 const h=setup({storage,respond:(request,ctx)=>{
  if(request.action==='read')return ctx.reply(fresh,'r2');
  if(++commits===1){assert.deepEqual(request,saved.request);return conflict()}
  assert.notEqual(request.requestId,saved.request.requestId);assert.equal(request.revision,'r2');assert.equal(request.mutations.length,1);assert.deepEqual(request.mutations[0].before,canonical(base.activities[0]));
  assert.equal(request.mutations[0].record.outcome,'My pending outcome');const pending=ctx.cloud.pendingBackup;assert.equal(pending.desired.activities.length,2);assert.equal(pending.desired.applications.length,1);
  const result=clone(fresh);result.activities[0]={...result.activities[0],...request.mutations[0].record};return ctx.reply(result,'r3');
 }});
 await h.cloud.connect();const result=await h.cloud.retry();assert.equal(result.activities.length,2);assert.equal(result.applications.length,1);assert.equal(result.activities[0].outcome,'My pending outcome');assert.equal(commits,2);assert.equal(h.cloud.hasPending,false);
}
async function realConflictAndRefresh(){
 const base=data(),desired=changed(base),saved=legacy(base,desired),fresh=clone(base);fresh.activities[0].outcome='Changed directly in Sheets';
 const storage=memory(),key='my-reintegration-pending-v2:editor%40example.invalid';storage.setItem(key,JSON.stringify(saved));
 const h=setup({storage,respond:(request,ctx)=>request.action==='read'?ctx.reply(fresh,'r2'):conflict()});await h.cloud.connect();
 await assert.rejects(h.cloud.retry(),e=>e.code==='CONFLICT'&&/pending changes are kept/.test(e.message));
 assert.equal(h.calls.filter(r=>r.action==='commit').length,1);assert.deepEqual(clone(h.cloud.pendingBackup),saved);assert.equal(storage.getItem(key),JSON.stringify(saved));assert.equal(h.events.at(-1).status,'Conflict');
 const current=await h.cloud.refresh();assert.equal(current.activities[0].outcome,'Changed directly in Sheets');assert.deepEqual(clone(h.cloud.pendingBackup),saved);assert.equal(h.calls.filter(r=>r.action==='commit').length,1);
 const exported=h.cloud.pendingBackup;exported.request.revision='tampered';assert.equal(h.cloud.pendingBackup.request.revision,'r1');
 await assert.rejects(h.cloud.commit(desired),e=>e.code==='PENDING');assert.equal(h.cloud.hasPending,true);
}
async function timeoutReceipt(){
 const base=data(),next=changed(base),confirmed=clone(next);let sent,writes=0;
 const h=setup({respond:(request,ctx)=>{
  if(request.action==='read')return ctx.reply(base);
  if(!sent){sent=clone(request);writes++;throw new TypeError('Network failed after server committed')}
  assert.deepEqual(request,sent);return ctx.reply(confirmed,'r2',{replayed:true});
 }});
 await h.cloud.connect();await assert.rejects(h.cloud.commit(next),/Network failed/);assert.equal(h.calls.length,2);assert.equal(h.cloud.hasPending,true);
 next.activities[0].outcome='Caller changed its local object';assert.equal(h.cloud.pendingBackup.desired.activities[0].outcome,'My pending outcome');
 const result=await h.cloud.retry();assert.equal(result.activities[0].outcome,'My pending outcome');assert.equal(writes,1);assert.equal(h.calls.length,3);assert.equal(h.cloud.hasPending,false);
}
async function alreadyRecorded(){
 const base=data(),desired=changed(base),saved=legacy(base,desired),fresh=clone(desired);fresh.activities.push(activity('external-0001'));
 const storage=memory();storage.setItem('my-reintegration-pending-v2:editor%40example.invalid',JSON.stringify(saved));
 const h=setup({storage,respond:(request,ctx)=>request.action==='read'?ctx.reply(fresh,'r2'):conflict()});await h.cloud.connect();
 const result=await h.cloud.retry();assert.equal(result.activities.length,2);assert.equal(result.activities[0].outcome,'My pending outcome');assert.equal(h.calls.filter(r=>r.action==='commit').length,1);assert.equal(h.cloud.hasPending,false);
}
async function conflictingTargets(){
 for(const scenario of ['delete-changed','put-deleted','new-id-collision','settings-changed']){
  const base=data(),desired=changed(base),fresh=clone(base);let mutation;
  if(scenario==='delete-changed'){desired.activities=[];mutation={type:'delete',kind:'activities',id:base.activities[0].id};fresh.activities[0].minutes=120}
  if(scenario==='put-deleted'){mutation={type:'put',kind:'activities',record:canonical(desired.activities[0])};fresh.activities=[]}
  if(scenario==='new-id-collision'){const added=activity('new-record-0001');desired.activities.push(added);mutation={type:'put',kind:'activities',record:canonical(added)};fresh.activities.push({...added,outcome:'Other editor created this ID'})}
  if(scenario==='settings-changed'){desired.settings.goal=18;mutation={type:'settings',settings:clone(desired.settings)};fresh.settings.name='Changed name'}
  const saved=legacy(base,desired,[mutation]),storage=memory();storage.setItem('my-reintegration-pending-v2:editor%40example.invalid',JSON.stringify(saved));
  const h=setup({storage,respond:(request,ctx)=>request.action==='read'?ctx.reply(fresh,'r2'):conflict()});await h.cloud.connect();await assert.rejects(h.cloud.retry(),e=>e.code==='CONFLICT',scenario);assert.equal(h.calls.filter(r=>r.action==='commit').length,1,scenario);assert.deepEqual(clone(h.cloud.pendingBackup),saved,scenario);
 }
}
async function multiMutationRebase(){
 const base=data();base.applications=[application()];const desired=clone(base);desired.activities=[];desired.settings.goal=18;desired.applications[0].result='My result';
 const mutations=[{type:'delete',kind:'activities',id:base.activities[0].id},{type:'settings',settings:clone(desired.settings)},{type:'put',kind:'applications',record:canonical(desired.applications[0])}];
 const saved=legacy(base,desired,mutations),fresh=clone(base);fresh.activities.push(activity('external-0001'));fresh.applications[0].result='My result';
 const storage=memory();storage.setItem('my-reintegration-pending-v2:editor%40example.invalid',JSON.stringify(saved));let commits=0;
 const h=setup({storage,respond:(request,ctx)=>{
  if(request.action==='read')return ctx.reply(fresh,'r2');if(++commits===1)return conflict();
  assert.equal(request.mutations.length,2);assert.equal(request.mutations.some(m=>m.kind==='applications'),false);assert.deepEqual(request.mutations.find(m=>m.type==='delete').before,canonical(base.activities[0]));assert.deepEqual(request.mutations.find(m=>m.type==='settings').before,base.settings);
  const result=ctx.cloud.pendingBackup.desired;assert.deepEqual(result.activities.map(r=>r.id),['external-0001']);assert.equal(result.settings.goal,18);assert.equal(result.applications[0].result,'My result');return ctx.reply(result,'r3');
 }});await h.cloud.connect();await h.cloud.retry();assert.equal(h.cloud.hasPending,false);
}
async function boundedRebase(){
 const base=data(),desired=changed(base),saved=legacy(base,desired),fresh=clone(base);fresh.activities.push(activity('external-0001'));
 const storage=memory();storage.setItem('my-reintegration-pending-v2:editor%40example.invalid',JSON.stringify(saved));
 const h=setup({storage,respond:(request,ctx)=>request.action==='read'?ctx.reply(fresh,'r2'):conflict()});await h.cloud.connect();await assert.rejects(h.cloud.retry(),e=>e.code==='CONFLICT');
 assert.equal(h.calls.length,4);assert.equal(h.calls.filter(r=>r.action==='commit').length,2);const pending=h.cloud.pendingBackup;assert.notEqual(pending.request.requestId,saved.request.requestId);assert.equal(pending.request.revision,'r2');assert.equal(pending.desired.activities.length,2);assert.equal(pending.desired.activities[0].outcome,'My pending outcome');
}
async function persistBeforeRetry(){
 const base=data(),desired=changed(base),saved=legacy(base,desired),fresh=clone(base);fresh.activities.push(activity('external-0001'));
 const storage=memory(),key='my-reintegration-pending-v2:editor%40example.invalid';storage.setItem(key,JSON.stringify(saved));
 const h=setup({storage,respond:(request,ctx)=>request.action==='read'?ctx.reply(fresh,'r2'):conflict()});await h.cloud.connect();storage.setItem=()=>{throw new Error('Storage quota exceeded')};
 await assert.rejects(h.cloud.retry(),/Storage quota/);assert.equal(h.calls.filter(r=>r.action==='commit').length,1);assert.deepEqual(clone(h.cloud.pendingBackup),saved);assert.equal(storage.getItem(key),JSON.stringify(saved));
}
(async()=>{
 for(const [label,test] of [
  ['owner/editor writes and canonical per-record before values; reader denial',editorContract],
  ['legacy pending rebases disjoint external additions without deleting them',legacyDisjoint],
  ['real conflict keeps original recovery data; Refresh stays read-only',realConflictAndRefresh],
  ['ambiguous failure retries original receipt ID exactly once',timeoutReceipt],
  ['already-recorded result resolves pending without another write',alreadyRecorded],
  ['changed/deleted records, ID collisions and settings conflicts preserve pending',conflictingTargets],
  ['mixed pending batch preserves external rows and omits already-recorded changes',multiMutationRebase],
  ['a further concurrent change stops after one rebase',boundedRebase],
  ['recovery storage failure prevents sending the rebased request',persistBeforeRetry]
 ]){await test();console.log('PASS',label)}
})().catch(error=>{console.error(error);process.exitCode=1});
