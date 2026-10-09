// Browser tests use a simulated HTMLService transport and separate browser contexts.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');const {PDFDocument}=require('pdf-lib');
(async()=>{const browser=await chromium.launch({headless:true});const context=await browser.newContext({acceptDownloads:true});let unavailable=false,calls=[],errors=[];const data={version:1,settings:{goal:20,name:'',recipient:''},activities:[{id:'test-0001',date:'2026-10-11',activity:'Isolated Sunday activity',category:'Other',outcome:'Test outcome',completed:'No',minutes:95,mail:'No'}],applications:[]};
await context.exposeBinding('guestTransport',(_,r)=>{assert.ok(!('token' in r));calls.push({operation:r.operation});return !unavailable?{ok:true,identity:'test-access',role:'reader',data}:{ok:false,code:'FORBIDDEN',message:'The journal is temporarily unavailable.'}});
await context.addInitScript(()=>{window.google={script:{get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),guestRequest:r=>window.guestTransport(r).then(success,failure)};return api}}}});
const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto('http://127.0.0.1:8765/apps-script-guest/View.html');await p.waitForFunction(()=>JournalCloud.role==='reader');assert.equal(await p.locator('#connect').isVisible(),false);assert.equal(await p.locator('#signout').isVisible(),false);
 await p.locator('#jump').fill('2026-10-11');await p.locator('#jump').dispatchEvent('change');await p.waitForFunction(()=>document.querySelector('#total').textContent==='1h 35m');assert.ok(calls.length>=2);
 assert.equal(await p.locator('[data-edit]:visible').count(),0);assert.equal(await p.locator('#add').isVisible(),false);assert.equal(await p.evaluate(async()=>{try{await JournalCloud.commit({});return false}catch{return true}}),true);
 await p.locator('#report').click();await p.locator('#reportDialog').waitFor({state:'visible'});assert.match(await p.locator('#reportText').textContent(),/Isolated Sunday activity/);
 for(const [id,ext] of [['excel','xlsx'],['pdf','pdf']]){const wait=p.waitForEvent('download');await p.locator('#'+id).click();await(await wait).saveAs('test-results/guest.'+ext);assert.equal(calls.at(-1).operation,'export.'+ext)}
 assert.equal(fs.readFileSync('test-results/guest.xlsx').subarray(0,2).toString(),'PK');assert.ok((await PDFDocument.load(fs.readFileSync('test-results/guest.pdf'))).getPageCount()>0);
 assert.deepEqual(await p.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
 unavailable=true;await p.locator('#excel').click();await p.waitForFunction(()=>!JournalCloud.role);assert.equal(await p.locator('#reportDialog').isVisible(),false);assert.equal(await p.locator('#reportText').textContent(),'');assert.equal(calls.at(-1).operation,'export.xlsx');
 await p.reload();assert.equal(await p.evaluate(()=>JournalCloud.role),'');
 const independent=await browser.newContext();const other=await independent.newPage();await other.goto('http://127.0.0.1:8765/apps-script-guest/View.html');assert.equal(await other.locator('#report').isEnabled(),false);assert.equal(await other.locator('#records').textContent().then(t=>t.includes('Isolated Sunday activity')),false);await independent.close();
 await p.setViewportSize({width:375,height:812});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS simulated direct-link browser: automatic read, navigation, per-export reads, XLSX/PDF, no writes, failure clears display, no credential storage, mobile');
}finally{await browser.close()}})();
