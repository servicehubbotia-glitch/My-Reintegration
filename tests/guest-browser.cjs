// Private-reader browser tests use synthetic HTMLService RPC only.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PDFDocument}=require('pdf-lib');
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});
 const TOKEN='A'.repeat(43),calls=[],errors=[];let denied=false;
 const activity=(id,date,minutes)=>({id,date,activity:'Synthetic private activity '+date,category:'Training',outcome:'Synthetic private result',completed:'Yes',minutes,mail:'No'});
 const data={version:1,settings:{goal:20,name:'Synthetic reader fixture',recipient:''},activities:[activity('fixture-activity-001','2026-10-11',95),activity('fixture-activity-002','2026-11-06',120)],applications:[{id:'fixture-application-001',date:'2026-10-11',function:'Synthetic role',company:'Synthetic company',via:'Test',conversation:'Synthetic notes',interview:'',withWhom:'Synthetic contact',phone:'',result:'Pending'}]};
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({acceptDownloads:true});
 await context.exposeBinding('privateLocation',({page})=>{const u=new URL(page.url());return {hash:u.hash.slice(1),parameter:Object.fromEntries(u.searchParams),parameters:{}}});
 await context.exposeBinding('guestTransport',(_,r)=>{
  calls.push({operation:r.operation,hasExpectedToken:r.token===TOKEN});
  return !denied&&r.token===TOKEN?{ok:true,identity:'synthetic-grant',role:'reader',data}: {ok:false,code:'FORBIDDEN',message:'Denied'};
 });
 await context.addInitScript(()=>{window.google={script:{url:{getLocation:callback=>window.privateLocation().then(callback)},get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),guestRequest:r=>window.guestTransport(r).then(success,failure)};return api}}}});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8765/apps-script-guest/View.html#access='+TOKEN+'&date=2026-10-11');
  await p.waitForFunction(()=>document.body.dataset.journalState==='ready');
  assert.equal(await p.locator('#jump').inputValue(),'2026-10-11');assert.equal(await p.locator('#total').textContent(),'1h 35m');
  assert.match(await p.locator('#dataSummary').textContent(),/2 activities/);
  for(const id of ['connect','signout','settings','shareView','add'])assert.equal(await p.locator('#'+id).isVisible(),false,id+' must be hidden from a reader');
  assert.equal(await p.locator('[data-edit]:visible').count(),0);assert.equal(await p.locator('[data-delete]:visible').count(),0);
  assert.equal(await p.evaluate(async()=>{try{await JournalCloud.commit({});return false}catch{return true}}),true);
  assert.equal(await p.getByRole('link',{name:'Edit my journal',exact:true}).getAttribute('href'),'https://servicehubbotia-glitch.github.io/My-Reintegration/?edit=1');
  const initialCalls=calls.length;
  await p.locator('#next').click();assert.equal(await p.locator('#total').textContent(),'0h 00m');
  await p.locator('#latest').click();assert.equal(await p.locator('#jump').inputValue(),'2026-11-06');assert.equal(await p.locator('#total').textContent(),'2h 00m');
  await p.locator('#jump').fill('2026-10-11');await p.locator('#jump').dispatchEvent('change');assert.equal(calls.length,initialCalls,'Date navigation uses the authorized complete snapshot');
  await p.locator('#refresh').click();await p.waitForFunction(()=>!JournalCloud.loading);assert.equal(await p.locator('#jump').inputValue(),'2026-10-11');assert.equal(await p.locator('#total').textContent(),'1h 35m');
  const reportCalls=calls.length;
  await p.locator('#allData').click();assert.equal(await p.locator('#reportScope').inputValue(),'all');assert.match(await p.locator('#reportText').textContent(),/3h 35m/);assert.match(await p.locator('#reportText').textContent(),/2026-11-06/);
  await p.locator('[data-close="reportDialog"]').click();await p.locator('#report').click();assert.match(await p.locator('#reportText').textContent(),/2026-10-11/);assert.ok(!(await p.locator('#reportText').textContent()).includes('Synthetic private activity 2026-11-06'));
  for(const [id,ext] of [['excel','xlsx'],['pdf','pdf'],['csv','csv']]){const wait=p.waitForEvent('download');await p.locator('#'+id).click();await(await wait).saveAs('test-results/private-reader.'+ext)}
  assert.equal(calls.length,reportCalls,'Confirmed downloads must not request another snapshot');
  assert.equal(fs.readFileSync('test-results/private-reader.xlsx').subarray(0,2).toString(),'PK');assert.ok((await PDFDocument.load(fs.readFileSync('test-results/private-reader.pdf'))).getPageCount()>0);assert.match(fs.readFileSync('test-results/private-reader.csv','utf8'),/Synthetic private activity/);
  assert.deepEqual(await p.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.ok(calls.every(call=>call.hasExpectedToken));
  await p.locator('[data-close="reportDialog"]').click();denied=true;await p.locator('#refresh').click();await p.waitForFunction(()=>!JournalCloud.role);
  assert.equal(await p.locator('#reportText').textContent(),'');assert.equal(await p.locator('#report').isEnabled(),false);assert.ok(!(await p.locator('#records').textContent()).includes('Synthetic private'));
  assert.match(await p.locator('#loadMessage').textContent(),/invalid, expired or revoked/);
  const beforeAnonymous=calls.length,anonymous=await context.newPage();anonymous.on('pageerror',e=>errors.push(e.message));
  await anonymous.goto('http://127.0.0.1:8765/apps-script-guest/View.html');await anonymous.waitForFunction(()=>document.body.dataset.journalState==='unavailable');
  assert.equal(calls.length,beforeAnonymous,'A missing token must never reach the RPC');assert.equal(await anonymous.locator('#report').isEnabled(),false);assert.ok(!(await anonymous.locator('#records').textContent()).includes('Synthetic private'));
  await anonymous.close();denied=false;await p.reload();await p.waitForFunction(()=>document.body.dataset.journalState==='ready');
  await p.setViewportSize({width:375,height:812});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:'test-results/private-reader-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS private reader browser: fragment-only authorization, full history, dated links, historical refresh, week/full downloads, no editing/storage, denied-state clearing, anonymous rejection, mobile');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
