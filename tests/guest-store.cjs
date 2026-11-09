// Isolated transports: never contact Google or the real spreadsheet.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const accepted={ok:true,role:'reader',identity:'link-reader',data:{version:1,settings:{goal:20,recipient:'',name:''},activities:[{activity:'Isolated record'}],applications:[]}};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
function clock(){
 let id=0;const jobs=new Map();
 return {setTimeout:(f,ms)=>{jobs.set(++id,{f,ms});return id},clearTimeout:i=>jobs.delete(i),
  async tick(ms){const entry=[...jobs].find(([,j])=>j.ms===ms);assert.ok(entry,'Expected timer '+ms);jobs.delete(entry[0]);entry[1].f();await flush()},jobs};
}
function setup(source,{publicMode,legacy=false,endpoint='https://script.google.com/macros/s/deployment_example/exec'}={}){
 const calls=[],scripts=[],removed=[],classes=new Set(),events=[],timers=clock(),window={};
 if(publicMode!==undefined)window.MR_PUBLIC_MODE=publicMode;
 if(publicMode)window.MR_GOOGLE_CONFIG={guestUrl:endpoint};
 const localStorage={removeItem:k=>removed.push(k),getItem:()=>{throw Error('Must not read credentials')},setItem:()=>{throw Error('Must not persist credentials or records')}};
 const document={body:{classList:{add:x=>classes.add(x)}},head:{appendChild:script=>scripts.push(script)},createElement:tag=>{assert.equal(tag,'script');return {remove(){this.removed=true}}}};
 const context={window,localStorage,document,URL,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout};
 if(legacy)context.google={script:{get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),guestRequest:request=>calls.push({request,success,failure})};return api}}};
 vm.runInNewContext(source,context);const cloud=window.JournalCloud;
 if(cloud)cloud.onStatus(e=>events.push({...e}));
 return {cloud,window,context,calls,scripts,removed,classes,events,timers,
  callback:script=>new URL(script.src).searchParams.get('callback'),
  succeed(script,result=accepted){const callback=new URL(script.src).searchParams.get('callback');window[callback](result)}};
}
async function legacySuite(source){
 const h=setup(source,{legacy:true}),{cloud,calls,timers}=h;
 assert.deepEqual(h.removed,['my-reintegration-guest-access-v1']);assert.ok(h.classes.has('guest-view'));assert.equal(cloud.publicLink,true);
 assert.equal(h.events[0].status,'Loading journal…');
 let pending=cloud.connect();assert.equal(cloud.refresh(),pending);assert.equal(cloud.authorizedRead('read','2026-11-02'),pending);
 assert.deepEqual(Object.keys(calls[0].request).sort(),['operation','week']);assert.equal(calls[0].request.operation,'read');assert.equal(cloud.role,'');
 calls.shift().success(accepted);assert.equal((await pending).activities[0].activity,'Isolated record');assert.equal(cloud.role,'reader');assert.equal(cloud.loading,false);
 for(const method of ['commit','retry','discardPending'])await assert.rejects(cloud[method]({}),/Read-only/);
 await assert.rejects(cloud.authorizedRead('delete','2026-10-05'),/Read-only/);assert.equal(calls.length,0);
 pending=cloud.authorizedRead('export.xlsx','2026-10-05');assert.equal(calls[0].request.operation,'export.xlsx');calls.shift().success(accepted);await pending;
 pending=cloud.refresh();calls.shift().failure();await flush();assert.equal(cloud.status,'Reconnecting…');await timers.tick(600);calls.shift().failure();
 await assert.rejects(pending,/Connection error/);assert.equal(cloud.role,'');assert.equal(cloud.loading,false);assert.match(cloud.lastError,/Refresh/);
 pending=cloud.refresh();calls.shift().success(accepted);await pending;assert.equal(cloud.role,'reader');
 pending=cloud.refresh();let stale=calls.shift();let rejected=assert.rejects(pending,/View closed/);cloud.disconnect();stale.success(accepted);await rejected;assert.equal(cloud.role,'');
 pending=cloud.refresh();stale=calls.shift();rejected=assert.rejects(pending,/View closed/);cloud.disconnect();const fresh=cloud.connect();calls.shift().success(accepted);await fresh;stale.failure();await rejected;assert.equal(cloud.role,'reader');
 pending=cloud.refresh();calls.shift().success({ok:true,data:null});await assert.rejects(pending,/could not load/);assert.equal(cloud.role,'');assert.equal(timers.jobs.size,0);
 pending=cloud.refresh();calls.shift().success({ok:false,code:'FORBIDDEN',message:'Access unavailable.'});await assert.rejects(pending,/Access unavailable/);assert.equal(timers.jobs.size,0);
}
async function jsonpSuite(source){
 const h=setup(source,{publicMode:true}),{cloud,scripts,timers,window}=h;
 let pending=cloud.connect();assert.equal(cloud.refresh(),pending);assert.equal(scripts.length,1);
 let script=scripts.at(-1),url=new URL(script.src),callback=h.callback(script);
 assert.equal(url.origin,'https://script.google.com');assert.equal(url.pathname,'/macros/s/deployment_example/exec');
 assert.match(callback,/^MR_read_[a-z0-9_]{1,80}$/);assert.equal(url.searchParams.get('operation'),'read');assert.equal(script.referrerPolicy,'no-referrer');
 h.succeed(script);await pending;assert.equal(cloud.role,'reader');assert.equal(script.removed,true);assert.equal(window[callback],undefined);assert.equal(timers.jobs.size,0);
 pending=cloud.authorizedRead('export.pdf','2026-11-02');script=scripts.at(-1);url=new URL(script.src);assert.equal(url.searchParams.get('operation'),'export.pdf');assert.equal(url.searchParams.get('week'),'2026-11-02');h.succeed(script);await pending;
 pending=cloud.refresh();script=scripts.at(-1);callback=h.callback(script);script.onerror();await flush();assert.equal(script.removed,true);assert.equal(window[callback],undefined);await timers.tick(600);
 const recovered=scripts.at(-1);assert.notEqual(h.callback(recovered),callback);h.succeed(recovered);await pending;assert.equal(cloud.role,'reader');
 pending=cloud.refresh();const timeout1=scripts.at(-1);await timers.tick(20000);await timers.tick(600);const timeout2=scripts.at(-1);await timers.tick(20000);await assert.rejects(pending,/did not respond/);
 assert.equal(cloud.role,'');assert.equal(cloud.loading,false);assert.equal(timeout1.removed,true);assert.equal(timeout2.removed,true);assert.equal(window[h.callback(timeout1)],undefined);assert.equal(window[h.callback(timeout2)],undefined);assert.equal(timers.jobs.size,0);
 pending=cloud.refresh();script=scripts.at(-1);script.onload();await assert.rejects(pending,/could not load/);assert.equal(cloud.role,'');assert.equal(timers.jobs.size,0);
 pending=cloud.refresh();script=scripts.at(-1);const late=window[h.callback(script)],rejected=assert.rejects(pending,/View closed/);cloud.disconnect();const fresh=cloud.connect();h.succeed(scripts.at(-1));await fresh;late({ok:false});await rejected;assert.equal(cloud.role,'reader');
 const noEndpoint=setup(source,{publicMode:true,endpoint:'https://example.invalid/data'});await assert.rejects(noEndpoint.cloud.connect(),/not configured/);assert.equal(noEndpoint.scripts.length,0);assert.equal(noEndpoint.timers.jobs.size,0);
}
function modes(source){
 const config=fs.readFileSync('google-config.js','utf8'),owner=fs.readFileSync('google-store.js','utf8');
 for(const [hostname,pathname,search,expected] of [
  ['servicehubbotia-glitch.github.io','/My-Reintegration/','',true],
  ['servicehubbotia-glitch.github.io','/My-Reintegration/index.html','?date=2026-11-06',true],
  ['servicehubbotia-glitch.github.io','/My-Reintegration','',true],
  ['servicehubbotia-glitch.github.io','/My-Reintegration/','?edit=1',false],
  ['servicehubbotia-glitch.github.io','/Other/','',false],
  ['localhost','/','',false],['localhost','/','?view=1',true],['localhost','/','?view=1&edit=1',false]
 ]){
  const window={location:{hostname,pathname,search,replace(){throw Error('Public URL must not redirect')}}},context={window,URLSearchParams};
  vm.runInNewContext(config,context);assert.equal(window.MR_PUBLIC_MODE,expected);assert.equal(window.MR_GOOGLE_CONFIG.publicUrl,'https://servicehubbotia-glitch.github.io/My-Reintegration/');
  if(expected){window.JournalCloud={sentinel:true};vm.runInNewContext(owner,context);assert.equal(window.JournalCloud.sentinel,true)}
  else {vm.runInNewContext(owner,context);const editor=window.JournalCloud;assert.ok(editor);vm.runInNewContext(source,context);assert.equal(window.JournalCloud,editor);assert.equal(editor.publicLink,undefined)}
 }
 const unavailable=setup(source);assert.ok(unavailable.cloud,'Legacy View must have a controlled error if the Apps Script transport is unavailable');
 const rejected=unavailable.cloud.connect().catch(e=>e);
 return (async()=>{const error=await rejected;assert.equal(error.code,'SETUP_REQUIRED');assert.equal(unavailable.cloud.role,'');assert.equal(unavailable.timers.jobs.size,0)})();
}
(async()=>{
 const source=fs.readFileSync('guest-store.js','utf8');
 await modes(source);await legacySuite(source);await jsonpSuite(source);
 console.log('PASS source transports: stable public URL, owner isolation, JSONP and Apps Script, deduplication, retry/timeout, callback cleanup, stale responses, no storage or writes');
 if(!process.argv.includes('--source-only')){
  const inline=[...fs.readFileSync('apps-script-guest/View.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.JournalCloud='));
  assert.ok(inline);await legacySuite(inline);console.log('PASS generated Apps Script View transport');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
