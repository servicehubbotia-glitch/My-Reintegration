// Isolated private-reader tests: never contact Google or the real spreadsheet.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const TOKEN='A'.repeat(43),NEXT_TOKEN='B'.repeat(42)+'A';
const accepted={ok:true,role:'reader',identity:'isolated-grant',data:{version:1,settings:{goal:20,recipient:'',name:''},
 activities:[{id:'a1',date:'2026-10-05',activity:'Isolated earlier activity'},{id:'a2',date:'2026-11-06',activity:'Isolated later activity'}],
 applications:[{id:'p1',date:'2026-10-06',company:'Example one'},{id:'p2',date:'2026-11-05',company:'Example two'}]}};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function clock(){
 let id=0;const jobs=new Map();
 return {setTimeout:(f,ms)=>{jobs.set(++id,{f,ms});return id},clearTimeout:i=>jobs.delete(i),
  async tick(ms){const entry=[...jobs].find(([,j])=>j.ms===ms);assert.ok(entry,'Expected timer '+ms);jobs.delete(entry[0]);entry[1].f();await flush()},jobs};
}
function setup(source,{mode,publicMode,legacy=true,hash='access='+TOKEN,deferLocation=false,locationApi=true}={}){
 const calls=[],rpcHistory=[],locationCalls=[],removed=[],classes=new Set(),events=[],timers=clock(),logs=[],created=[];
 const location={hash,parameter:{},parameters:{}};
 const window={location:{hash:'#access='+NEXT_TOKEN,search:'?token='+NEXT_TOKEN,hostname:'script.googleusercontent.com',href:'https://script.googleusercontent.com/isolated'},
  MR_GOOGLE_CONFIG:{guestUrl:'https://script.google.com/macros/s/isolated/exec',publicUrl:'https://servicehubbotia-glitch.github.io/My-Reintegration/'}};
 if(mode!==undefined)window.MR_MODE=mode;
 if(publicMode!==undefined)window.MR_PUBLIC_MODE=publicMode;
 const localStorage={removeItem:k=>removed.push(k),getItem:()=>{throw Error('Must not read browser credentials')},setItem:()=>{throw Error('Must not persist credentials or records')}};
 const sessionStorage={getItem:()=>{throw Error('Must not read session credentials')},setItem:()=>{throw Error('Must not persist session credentials')}};
 const document={body:{classList:{add:x=>classes.add(x)},dataset:{}},createElement:tag=>{created.push(tag);throw Error('No dynamic transport elements permitted')}};
 const context={window,localStorage,sessionStorage,document,URL,URLSearchParams,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,
  console:{log:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},fetch:()=>{throw Error('No network fetch permitted')}};
 if(legacy)context.google={script:{
  ...(locationApi?{url:{getLocation:callback=>{locationCalls.push(callback);if(!deferLocation)callback(location)}}}:{}),
  get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),
   guestRequest:request=>{const call={request,success,failure};calls.push(call);rpcHistory.push(call)}};return api}
 }};
 vm.createContext(context);vm.runInContext(source,context);const cloud=window.JournalCloud;
 if(cloud)cloud.onStatus(e=>events.push({...e}));
 return {cloud,window,context,document,calls,rpcHistory,location,locationCalls,removed,classes,events,timers,logs,created};
}
async function modes(source){
 for(const mode of ['demo','editor','unrecognized']){
  const context={window:{MR_MODE:mode,JournalCloud:{sentinel:true}}};
  vm.runInNewContext(source,context);assert.equal(context.window.JournalCloud.sentinel,true);
 }
 const oldEditor={window:{MR_PUBLIC_MODE:false,JournalCloud:{sentinel:true}}};
 vm.runInNewContext(source,oldEditor);assert.equal(oldEditor.window.JournalCloud.sentinel,true);
 const explicitReader=setup(source,{mode:'reader',publicMode:false});assert.ok(explicitReader.cloud);
 assert.equal(explicitReader.cloud.privateLink,true);
 for(const options of [{mode:'reader',legacy:false},{publicMode:true,legacy:false},{legacy:false},{legacy:true,locationApi:false}]){
  const h=setup(source,options);
  await assert.rejects(h.cloud.connect(),e=>e.code==='SETUP_REQUIRED'&&/private journal link/.test(e.message));
  assert.equal(h.cloud.role,'');assert.equal(h.calls.length,0);assert.equal(h.created.length,0);
  assert.equal(h.locationCalls.length,0);assert.equal(h.timers.jobs.size,0);
 }
}
async function fragments(source){
 for(const hash of ['',null,'access=','access=short','access='+TOKEN+'x','access='+TOKEN+'&access='+NEXT_TOKEN,
  'access='+TOKEN+'&access=','token='+TOKEN,'access='+TOKEN.slice(0,42)+'%2F','access='+TOKEN+'%0A']){
  const h=setup(source,{hash});
  h.location.parameter={access:TOKEN,token:TOKEN}; // Query credentials must never be accepted.
  await assert.rejects(h.cloud.connect(),e=>e.code==='FORBIDDEN'&&!e.retryable);
  assert.equal(h.calls.length,0);assert.equal(h.locationCalls.length,1);assert.equal(h.cloud.role,'');
  assert.equal(h.timers.jobs.size,0);assert.equal(h.cloud.status,'Access unavailable');
 }
 const h=setup(source,{hash:'#access='+encodeURIComponent(TOKEN)+'&date=2026-10-05&week=2026-10-05'});
 h.location.parameter={date:'2026-11-06',week:'2026-11-02'};h.location.parameters={date:['2026-11-06'],week:['2026-11-02']};
 const pending=h.cloud.connect();assert.equal(h.calls[0].request.token,TOKEN);
 assert.notEqual(h.calls[0].request.token,NEXT_TOKEN,'The iframe URL must not supply the credential');
 h.calls.shift().success(accepted);await pending;assert.equal(h.cloud.initialDate,'2026-10-05');assert.equal(h.cloud.initialWeek,'2026-10-05');
 h.location.hash='access='+NEXT_TOKEN+'&date=2026-02-30&week=2026-10-05&week=2026-11-02';
 const refreshed=h.cloud.refresh();assert.equal(h.calls[0].request.token,NEXT_TOKEN);h.calls.shift().success(accepted);await refreshed;
 assert.equal(h.cloud.initialDate,'');assert.equal(h.cloud.initialWeek,'');
 assert.equal(h.locationCalls.length,2,'Refresh must reread the current authorized-link fragment');
 h.location.hash='access='+TOKEN;
 const legacyDate=h.cloud.refresh();h.calls.shift().success(accepted);await legacyDate;
 assert.equal(h.cloud.initialDate,'2026-11-06');assert.equal(h.cloud.initialWeek,'2026-11-02','Legacy query date hints remain supported when absent from the fragment');
 assert.deepEqual(h.removed,['my-reintegration-guest-access-v1']);assert.deepEqual(h.created,[]);assert.deepEqual(h.logs,[]);
 assert.ok(!JSON.stringify(h.events).includes(TOKEN));assert.ok(!JSON.stringify(h.events).includes(NEXT_TOKEN));
 assert.equal(h.window.location.search,'?token='+NEXT_TOKEN,'The reader never creates or rewrites query credentials');
}
async function transportSuite(source){
 const h=setup(source),{cloud,calls,timers}=h;
 assert.ok(h.classes.has('guest-view'));assert.equal(cloud.privateLink,true);assert.equal(cloud.publicLink,true);
 assert.equal(h.events[0].status,'Loading journal…');
 let pending=cloud.connect();assert.equal(cloud.refresh(),pending);assert.equal(cloud.authorizedRead('read','2026-10-05'),pending);
 assert.deepEqual(Object.keys(calls[0].request).sort(),['operation','token','week']);assert.equal(calls[0].request.operation,'read');assert.equal(cloud.role,'');
 calls.shift().success(accepted);assert.equal(await pending,accepted.data);assert.equal(cloud.role,'reader');assert.equal(cloud.loading,false);
 assert.equal(h.locationCalls.length,1);assert.equal(h.rpcHistory.length,1);
 for(const method of ['commit','retry','discardPending'])await assert.rejects(cloud[method]({}),/Read-only/);
 await assert.rejects(cloud.authorizedRead('delete','2026-10-05'),/Read-only/);
 await assert.rejects(cloud.authorizedRead('export.xlsx','invalid'),/Choose a report week/);assert.equal(calls.length,0);
 pending=cloud.authorizedRead('export.xlsx','2026-10-05');assert.equal(calls[0].request.operation,'export.xlsx');assert.equal(calls[0].request.week,'2026-10-05');
 calls.shift().success(accepted);assert.equal((await pending).applications.length,2,'Authorized reads retain the whole history');
 pending=cloud.refresh();calls.shift().failure({message:TOKEN});await flush();assert.equal(cloud.status,'Reconnecting…');await timers.tick(600);calls.shift().failure({message:TOKEN});
 await assert.rejects(pending,/Connection error/);assert.equal(cloud.role,'');assert.equal(cloud.loading,false);assert.match(cloud.lastError,/Refresh/);assert.ok(!cloud.lastError.includes(TOKEN));
 pending=cloud.refresh();calls.shift().success(accepted);await pending;assert.equal(cloud.role,'reader');
 pending=cloud.refresh();let stale=calls.shift();let rejected=assert.rejects(pending,/View closed/);cloud.disconnect();stale.success(accepted);await rejected;assert.equal(cloud.role,'');
 pending=cloud.refresh();stale=calls.shift();rejected=assert.rejects(pending,/View closed/);cloud.disconnect();const fresh=cloud.connect();calls.shift().success(accepted);await fresh;stale.failure();await rejected;assert.equal(cloud.role,'reader');
 pending=cloud.refresh();calls.shift().success({ok:true,role:'reader',data:null});await assert.rejects(pending,/could not load/);assert.equal(cloud.role,'');assert.equal(timers.jobs.size,0);
 pending=cloud.refresh();calls.shift().success({ok:false,code:'SERVICE_ERROR',message:TOKEN});await assert.rejects(pending,/unavailable/);assert.ok(!cloud.lastError.includes(TOKEN));
 pending=cloud.refresh();calls.shift().success({ok:false,code:'BUSY',message:TOKEN});await flush();await timers.tick(600);calls.shift().success(accepted);await pending;
 pending=cloud.refresh();calls.shift();await timers.tick(20000);await timers.tick(600);calls.shift();await timers.tick(20000);await assert.rejects(pending,/did not respond/);
 assert.equal(cloud.role,'');assert.equal(cloud.loading,false);assert.equal(timers.jobs.size,0);
 pending=cloud.refresh();calls.shift().failure();await flush();rejected=assert.rejects(pending,/View closed/);cloud.disconnect();await rejected;assert.equal(timers.jobs.size,0,'Closing a view also cancels retry delays');
 assert.deepEqual(h.created,[]);assert.deepEqual(h.logs,[]);assert.ok(!JSON.stringify(h.events).includes(TOKEN));
}
async function deniedAndDelayed(source){
 const h=setup(source),{cloud,calls,timers}=h;
 let pending=cloud.connect();calls.shift().success(accepted);await pending;
 const old=cloud.authorizedRead('report','2026-10-05'),stale=calls.shift(),oldRejected=assert.rejects(old,/View closed/);
 pending=cloud.refresh();const denied=calls.shift(),count=h.rpcHistory.length;
 const rejection=assert.rejects(pending,e=>e.code==='FORBIDDEN'&&!e.retryable);
 denied.success({ok:false,code:'FORBIDDEN',message:TOKEN});await rejection;await oldRejected;
 stale.success(accepted);await flush();assert.equal(cloud.role,'');assert.equal(cloud.status,'Access unavailable');assert.equal(cloud.loading,false);
 assert.equal(h.rpcHistory.length,count,'A denied credential must not be retried');assert.equal(timers.jobs.size,0);assert.ok(!cloud.lastError.includes(TOKEN));
 const delayed=setup(source,{deferLocation:true});pending=delayed.cloud.connect();let rejected=assert.rejects(pending,/View closed/);
 delayed.cloud.disconnect();delayed.locationCalls[0](delayed.location);await rejected;assert.equal(delayed.calls.length,0,'A late fragment callback cannot start a cancelled read');
 pending=delayed.cloud.connect();delayed.locationCalls[1](delayed.location);delayed.calls.shift().success(accepted);await pending;assert.equal(delayed.cloud.role,'reader');
}
function viewHarness(source){
 const h=setup(source),nodes=new Map(),handlers={},toasts=[],actions=[],downloadClears=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',hidden:false,open:false,onclick:()=>actions.push(id),onchange:()=>actions.push(id),
  close(){this.open=false},append(){}});return nodes.get(id)};
 const empty=()=>({version:1,settings:{goal:20,recipient:'',name:''},activities:[],applications:[]});
 const plus=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const monday=s=>plus(s,-((new Date(s+'T12:00:00Z').getUTCDay()+6)%7));
 const ctx=h.context;
 Object.assign(ctx,{cloud:h.cloud,state:empty(),selected:'2026-11-10',week:'2026-11-09',reportScope:'week',empty,plus,monday,
  validDate:s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s),validate:data=>JSON.parse(JSON.stringify(data)),
  $:selector=>node(selector.slice(1)),toast:message=>toasts.push(message),
  clearPreparedDownload:()=>downloadClears.push(true),
  render:()=>{node('records').textContent=JSON.stringify(ctx.state);node('dataSummary').textContent=String(ctx.state.activities.length)},
  fillReport:()=>{node('reportText').textContent=JSON.stringify(ctx.state)},
  allDates:()=>[...ctx.state.activities,...ctx.state.applications].map(r=>r.date).sort(),
  latestDate:()=>ctx.allDates().at(-1)||'2026-11-10'});
 node('prev').onclick=()=>{ctx.week=plus(ctx.week,-7);ctx.selected=plus(ctx.selected,-7);actions.push('prev')};
 node('allData').onclick=()=>{ctx.reportScope='all';node('reportDialog').open=true;ctx.fillReport();actions.push('allData')};
 h.document.querySelector=selector=>selector.startsWith('#')?node(selector.slice(1)):node(selector);
 h.document.querySelectorAll=()=>[...nodes.values()].filter(x=>x.open);
 h.document.createElement=tag=>{assert.equal(tag,'a');return node('created-link')};h.document.createTextNode=text=>text;
 h.window.addEventListener=(type,handler)=>handlers[type]=handler;
 h.window.history={replaceState:()=>{throw Error('Do not rewrite the HTMLService iframe address')}};
 return {...h,node,handlers,toasts,actions,downloadClears};
}
async function viewSuite(storeSource,viewSource){
 for(const mode of ['demo','editor'])vm.runInNewContext(viewSource,{window:{MR_MODE:mode}});
 const h=viewHarness(storeSource);vm.runInContext(viewSource,h.context);
 const {cloud,calls,node,context:ctx}=h;
 node('allData').onclick();assert.equal(h.actions.length,0,'Downloads stay closed until a snapshot is confirmed');
 calls.shift().success(accepted);await flush();assert.equal(ctx.selected,'2026-11-06');assert.equal(ctx.state.activities.length,2);
 assert.equal(h.document.body.dataset.journalState,'ready');
 const count=h.rpcHistory.length;node('prev').onclick();assert.equal(ctx.week,'2026-10-26');node('allData').onclick();
 assert.equal(ctx.reportScope,'all');assert.ok(node('reportText').textContent.includes('Isolated earlier activity'));
 for(const id of ['pdf','excel','csv','copy'])node(id).onclick();assert.equal(h.rpcHistory.length,count,'Navigation and downloads use the full confirmed snapshot without a new request');
 let refresh=node('refresh').onclick();const concurrent=node('refresh').onclick();assert.equal(calls.length,1);
 calls.shift().success(accepted);await refresh;await concurrent;assert.equal(ctx.week,'2026-10-26','Refreshing must preserve the selected historical week');
 node('emailTo').value='isolated@example.invalid';node('emailSubject').value='Isolated';node('emailBody').value='Isolated';
 const beforeDownloadClear=h.downloadClears.length;
 refresh=node('refresh').onclick();calls.shift().success({ok:false,code:'FORBIDDEN',message:TOKEN});await refresh;
 assert.ok(h.downloadClears.length>beforeDownloadClear,'Denied access must clear any prepared download');
 assert.equal(cloud.role,'');assert.equal(ctx.state.activities.length,0);assert.equal(ctx.state.applications.length,0);
 assert.equal(node('reportDialog').open,false);assert.equal(node('reportText').textContent,'');assert.equal(node('reportRange').textContent,'');
 for(const id of ['emailTo','emailSubject','emailBody'])assert.equal(node(id).value,'');
 assert.equal(h.document.body.dataset.journalState,'unavailable');assert.ok(!node('loadMessage').textContent.includes(TOKEN));
 const actionCount=h.actions.length;node('allData').onclick();node('csv').onclick();node('prev').onclick();assert.equal(h.actions.length,actionCount);
 refresh=node('refresh').onclick();const old=calls.shift();h.handlers.pagehide();old.success(accepted);await refresh;
 assert.equal(ctx.state.activities.length,0);assert.equal(cloud.role,'');
 h.handlers.pageshow({persisted:true});calls.shift().success(accepted);await flush();assert.equal(ctx.state.activities.length,2);assert.equal(cloud.role,'reader');
 assert.equal(node('.brand').referrerPolicy,'no-referrer');assert.equal(node('created-link').referrerPolicy,'no-referrer');
}
(async()=>{
 const source=fs.readFileSync('guest-store.js','utf8'),view=fs.readFileSync('guest-view.js','utf8');
 await modes(source);await fragments(source);await transportSuite(source);await deniedAndDelayed(source);await viewSuite(source,view);
 console.log('PASS private reader: mode isolation, fragment-only RPC, no JSONP or credential storage, full history, retries, cancellation, revoked-state clearing and confirmed-snapshot downloads');
 if(!process.argv.includes('--source-only')){
  const inline=[...fs.readFileSync('apps-script-guest/View.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.JournalCloud='));
  assert.ok(inline);await fragments(inline);await transportSuite(inline);await deniedAndDelayed(inline);
  console.log('PASS generated Apps Script View private transport');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
