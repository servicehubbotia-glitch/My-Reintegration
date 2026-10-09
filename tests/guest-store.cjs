// Isolated transport; never contacts Google or the real spreadsheet.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const accepted={ok:true,data:{activities:[{activity:'Isolated record'}]}};
async function suite(source){
 const calls=[],removed=[],window={};
 const localStorage={removeItem:k=>removed.push(k),getItem:()=>{throw Error('Must not read credentials')},setItem:()=>{throw Error('Must not persist credentials or records')}};
 const google={script:{get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),guestRequest:request=>calls.push({request,success,failure})};return api}}};
 vm.runInNewContext(source,{window,localStorage,google});const cloud=window.JournalCloud;
 assert.deepEqual(removed,['my-reintegration-guest-access-v1']);assert.equal(cloud.publicLink,true);
 let pending=cloud.connect();assert.deepEqual(Object.keys(calls[0].request).sort(),['operation','week']);assert.equal(calls[0].request.operation,'read');assert.equal(cloud.role,'');calls.shift().success(accepted);await pending;assert.equal(cloud.role,'reader');
 await assert.rejects(cloud.commit({}),/Read-only/);
 pending=cloud.authorizedRead('export.xlsx','2026-10-05');assert.equal(calls[0].request.operation,'export.xlsx');calls.shift().success(accepted);await pending;
 pending=cloud.refresh();calls.shift().failure();await assert.rejects(pending,/Connection error/);assert.equal(cloud.role,'');
 pending=cloud.refresh();calls.shift().success(accepted);await pending;assert.equal(cloud.role,'reader');
 pending=cloud.refresh();cloud.disconnect();calls.shift().success(accepted);await assert.rejects(pending,/View closed/);assert.equal(cloud.role,'');
 pending=cloud.refresh();const stale=calls.shift();cloud.disconnect();const fresh=cloud.connect();calls.shift().success(accepted);await fresh;stale.failure();await assert.rejects(pending);assert.equal(cloud.role,'reader');
}
(async()=>{await suite(fs.readFileSync('guest-store.js','utf8'));const inline=[...fs.readFileSync('apps-script-guest/View.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.JournalCloud='));assert.ok(inline);await suite(inline);console.log('PASS direct-link transport: no credentials, old credential cleanup, fresh reads/exports, no writes, failure recovery and stale callbacks');})().catch(e=>{console.error(e);process.exitCode=1});
