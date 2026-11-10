// Synthetic documents only. Match HTMLService's cross-origin nested frames.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
async function privateDownloadTest(browser){
 const ownBrowser=!browser;if(!browser)browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:true}),errors=[];
 const top='https://download-top.invalid/',outer='https://download-sandbox.invalid/',inner='https://download-reader.invalid/View.html';
 const sandbox='allow-same-origin allow-forms allow-scripts allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation';
 const token='A'.repeat(43);let denied=false,calls=0;
 const data={version:1,settings:{goal:20,name:'Synthetic download fixture',recipient:''},activities:[
  {id:'download-activity-001',date:'2026-10-11',activity:'Synthetic historical activity',category:'Training',outcome:'Synthetic result',completed:'Yes',minutes:95,mail:'No'},
  {id:'download-activity-002',date:'2026-11-06',activity:'Synthetic later activity',category:'Training',outcome:'Synthetic result',completed:'Yes',minutes:120,mail:'No'}
 ],applications:[]};
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(url===top)return route.fulfill({contentType:'text/html',body:`<!doctype html><iframe id="sandboxFrame" sandbox="${sandbox}" src="${outer}" style="width:100%;height:900px;border:0"></iframe>`});
  if(url===outer)return route.fulfill({contentType:'text/html',body:`<!doctype html><iframe id="userHtmlFrame" src="${inner}" style="width:100%;height:880px;border:0"></iframe>`});
  if(url===inner)return route.fulfill({contentType:'text/html',body:fs.readFileSync('apps-script-guest/View.html','utf8')});
  return route.abort();
 });
 await context.exposeBinding('fixtureLocation',()=>({hash:'access='+token+'&date=2026-10-11',parameter:{},parameters:{}}));
 await context.exposeBinding('fixtureRequest',(_,r)=>{
  calls++;assert.equal(r.token,token);
  return denied?{ok:false,code:'FORBIDDEN'}:{ok:true,identity:'synthetic-link',role:'reader',data};
 });
 await context.addInitScript(()=>{
  window.google={script:{url:{getLocation:callback=>window.fixtureLocation().then(callback)},get run(){let success,failure;const api={withSuccessHandler:f=>(success=f,api),withFailureHandler:f=>(failure=f,api),guestRequest:r=>window.fixtureRequest(r).then(success,failure)};return api}}};
  // Exercise recovery when an automatic click is cancelled, without changing the app.
  document.addEventListener('click',event=>{if(window.blockAutomaticDownloads&&!event.isTrusted&&event.target.closest?.('a[download]'))event.preventDefault()},true);
 });
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.clock.install();await p.goto(top);
  const reader=p.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
  await reader.locator('body[data-journal-state="ready"]').waitFor();
  const frame=p.frames().find(f=>f.url()===inner);assert.ok(frame);
  const prepared=()=>frame.locator('#reportDialog #preparedDownload a[download]');
  const currentUrl=()=>prepared().getAttribute('href');
  async function cleared(url){
   await frame.locator('#preparedDownload').waitFor({state:'detached'});
   assert.equal(await frame.evaluate(async value=>{try{await fetch(value);return false}catch{return true}},url),true,'Removed download URLs must be revoked');
  }
  function workbook(bytes){
   assert.equal(bytes.subarray(0,2).toString(),'PK');
   assert.ok(bytes.includes(Buffer.from('xl/worksheets/sheet1.xml')),'Download contains a worksheet');
   assert.ok(bytes.includes(Buffer.from('Synthetic historical activity')),'Download contains the authorized fixture');
  }
  async function save(download,name){
   fs.mkdirSync('test-results',{recursive:true});await download.saveAs('test-results/'+name);
   const bytes=fs.readFileSync('test-results/'+name);workbook(bytes);return bytes;
  }
  await frame.locator('#allData').click();const initialCalls=calls;
  const automatic=p.waitForEvent('download');await frame.locator('#excel').click();
  const original=await save(await automatic,'private-nested-automatic.xlsx');
  await prepared().waitFor({state:'visible'});assert.equal(await prepared().textContent(),'Save file');
  assert.match(await frame.locator('#preparedDownload').textContent(),/^Download prepared\./);
  const firstUrl=await currentUrl();assert.ok(firstUrl.startsWith('blob:'+new URL(inner).origin+'/'));
  await frame.evaluate(()=>{window.blockAutomaticDownloads=true});
  await frame.locator('#excel').click();const recoveryUrl=await currentUrl();assert.notEqual(recoveryUrl,firstUrl);
  assert.equal(await frame.evaluate(async value=>{try{await fetch(value);return false}catch{return true}},firstUrl),true,'Replacement revokes the previous file');
  const explicit=p.waitForEvent('download');await prepared().click();
  assert.ok((await save(await explicit,'private-nested-explicit.xlsx')).equals(original),'Explicit Save file preserves the complete generated workbook');
  assert.equal(await prepared().count(),1,'Saving does not remove the recovery link');
  assert.equal(calls,initialCalls,'Report downloads use the confirmed snapshot');
  await frame.locator('#reportScope').selectOption('week');await cleared(recoveryUrl);
  await frame.locator('#excel').click();let url=await currentUrl();
  await frame.locator('[data-close="reportDialog"]').click();await cleared(url);
  await frame.locator('#report').click();await frame.locator('#excel').click();url=await currentUrl();
  await frame.locator('#excel').press('Escape');await cleared(url);
  await frame.locator('#report').click();await frame.locator('#excel').click();url=await currentUrl();
  await p.clock.fastForward(5*60*1000+1);await cleared(url);
  await frame.locator('#excel').click();url=await currentUrl();denied=true;
  await frame.evaluate(()=>JournalCloud.refresh().catch(()=>{}));await cleared(url);
  assert.equal(await frame.locator('body').getAttribute('data-journal-state'),'unavailable');
  denied=false;await frame.locator('#refresh').click();await frame.locator('body[data-journal-state="ready"]').waitFor();
  await frame.locator('#report').click();await frame.locator('#excel').click();url=await currentUrl();
  await frame.evaluate(()=>JournalCloud.disconnect());await cleared(url);
  await frame.locator('#refresh').click();await frame.locator('body[data-journal-state="ready"]').waitFor();
  await frame.locator('#report').click();await frame.locator('#excel').click();url=await currentUrl();
  await frame.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await cleared(url);
  assert.deepEqual(await frame.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.deepEqual(errors,[]);
  console.log('PASS private nested-frame downloads: automatic and explicit XLSX, identical content, replacement/close/Escape/expiry/revocation/disconnect/pagehide cleanup, no storage');
 }finally{await context.close();if(ownBrowser)await browser.close()}
}
module.exports=privateDownloadTest;
if(require.main===module)privateDownloadTest().catch(error=>{console.error(error);process.exitCode=1});
