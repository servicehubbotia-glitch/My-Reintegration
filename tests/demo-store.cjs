// Synthetic demonstration tests. No browser storage, network or Google service is available.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('demo-store.js','utf8');
function setup(mode){
 const touched=[],sentinel={existing:true},window={MR_MODE:mode,JournalCloud:sentinel};
 const forbidden=name=>{touched.push(name);throw Error('Demo touched '+name)};
 for(const name of ['localStorage','sessionStorage','google','MR_GOOGLE_CONFIG'])Object.defineProperty(window,name,{get:()=>forbidden(name)});
 const context={window,fetch:()=>forbidden('fetch'),XMLHttpRequest:()=>forbidden('XMLHttpRequest'),WebSocket:()=>forbidden('WebSocket'),navigator:{sendBeacon:()=>forbidden('sendBeacon')}};
 for(const name of ['localStorage','sessionStorage','google','document'])Object.defineProperty(context,name,{get:()=>forbidden(name)});
 vm.runInNewContext(source,context,{filename:'demo-store.js'});
 return {cloud:window.JournalCloud,touched,sentinel,window};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const monday=value=>{const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));return date.toISOString().slice(0,10)};
(async()=>{
 for(const mode of ['reader','editor','',undefined]){
  const h=setup(mode);assert.equal(h.cloud,h.sentinel);assert.deepEqual(h.touched,[]);
 }
 const h=setup('demo'),cloud=h.cloud,events=[];
 const unsubscribe=cloud.onStatus(event=>events.push(plain(event)));
 assert.equal(cloud.demo,true);assert.equal(cloud.guest,false);assert.equal(cloud.role,'editor');assert.equal(cloud.identity,'demo');
 assert.equal(cloud.hasPending,false);assert.equal(cloud.pendingBackup,null);
 const initial=await cloud.connect(),totals=new Map();
 for(const row of initial.activities)totals.set(monday(row.date),(totals.get(monday(row.date))||0)+row.minutes);
 assert.deepEqual([...totals],[['2026-11-02',1200],['2026-11-09',1200]]);
 assert.equal(initial.applications.length,4);assert.equal(initial.settings.recipient,'');assert.match(initial.settings.name,/DEMO/);
 assert.ok(initial.activities.every(row=>row.activity.startsWith('[DEMO]')));
 assert.ok(initial.applications.every(row=>row.company.includes('(fictional)')&&row.phone===''));
 // Exercise the actual application's validator, so demo records match its supported schema.
 const app=fs.readFileSync('app.js','utf8'),boundary=app.indexOf('\nasync function persist(');assert.ok(boundary>0);
 const validationContext={window:{JournalCloud:cloud}};vm.createContext(validationContext);
 vm.runInContext(app.slice(0,boundary)+'\nglobalThis.validateDemoSnapshot=validate;',validationContext);
 validationContext.validateDemoSnapshot(initial);
 initial.activities[0].activity='Must not mutate the store';initial.settings.name='Must not leak into the store';
 const confirmed=await cloud.refresh();assert.ok(confirmed.activities[0].activity.startsWith('[DEMO]'));assert.match(confirmed.settings.name,/DEMO/);
 const next=plain(confirmed),originalCreated=next.activities[0].createdAt;
 next.activities[0].activity='[DEMO] Locally edited activity';next.activities[0].minutes=125;
 next.activities.push({...next.activities[1],id:'demo-added-activity',activity:'[DEMO] Added in this tab'});
 next.applications.splice(0,1);
 next.settings={goal:40,recipient:'fictional@example.invalid',name:'Changed settings'};
 const saved=await cloud.commit(next);
 assert.equal(saved.activities[0].activity,'[DEMO] Locally edited activity');assert.equal(saved.activities[0].minutes,125);
 assert.equal(saved.activities[0].createdAt,originalCreated);assert.equal(saved.activities.length,confirmed.activities.length+1);assert.equal(saved.applications.length,3);
 assert.deepEqual(plain(saved.settings),{goal:20,recipient:'',name:'DEMO — fictional records'});
 validationContext.validateDemoSnapshot(saved);
 next.activities[0].activity='Mutation after commit';saved.activities[0].activity='Mutation of returned data';
 const stable=await cloud.refresh();assert.equal(stable.activities[0].activity,'[DEMO] Locally edited activity');
 for(const makeInvalid of [
  data=>data.activities.push(plain(data.activities[0])),
  data=>{data.activities[0].minutes=-1},
  data=>{data.activities[0].date='2026-02-30'},
  data=>{data.applications[0].interview='not-a-date'}
 ]){
  const invalid=plain(stable);makeInvalid(invalid);await assert.rejects(cloud.commit(invalid),/Invalid/);
  assert.deepEqual(plain(await cloud.refresh()),plain(stable),'Invalid changes must be atomic');
 }
 await assert.rejects(cloud.manageAccess({operation:'create'}),/unavailable in the demo/);
 const second=setup('demo');assert.deepEqual(plain(await second.cloud.connect()),plain(confirmed),'Separate loads have independent sample data');
 const restored=await cloud.reset();assert.deepEqual(plain(restored),plain(confirmed));
 cloud.disconnect();assert.equal(cloud.role,'');await assert.rejects(cloud.commit(stable),/paused/);
 assert.deepEqual(plain(await cloud.connect()),plain(confirmed));
 assert.ok(events.some(event=>event.status==='Demo — saved only in this tab'));assert.ok(events.every(event=>!event.pending&&!event.loading));
 const count=events.length;unsubscribe();await cloud.reset();assert.equal(events.length,count);
 assert.deepEqual(h.touched,[]);assert.deepEqual(second.touched,[]);
 console.log('PASS demo: two fictional 20-hour weeks, application-schema compatibility, independent in-memory CRUD/reset, atomic validation, no storage/network/Google access, private sharing denied');
})().catch(error=>{console.error(error);process.exitCode=1});
