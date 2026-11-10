// Local demonstration only. Serve known app files and abort every external request.
'use strict';
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib');
const files=new Map(['index.html','style.css','google-config.js','google-store.js','guest-store.js','demo-store.js','excel-export.js','app.js','access-admin.js','guest-view.js','demo-view.js'].map(name=>['/'+name,fs.readFileSync(name)]));
const server=http.createServer((request,response)=>{
 const path=new URL(request.url,'http://localhost').pathname,name=path==='/'?'/index.html':path,body=files.get(name);
 response.writeHead(body?200:404,{'Content-Type':name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});
 response.end(body||'Not found');
});
const download=async(page,id)=>{
 const ready=page.waitForEvent('download');await page.locator('#'+id).click();const file=await ready;
 assert.match(file.suggestedFilename(),/^demo-/,'Every demo download must be named as a demo');
 const stream=await file.createReadStream(),parts=[];for await(const chunk of stream)parts.push(chunk);
 return Buffer.concat(parts);
};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,...(process.env.DEMO_BROWSER_EXECUTABLE?{executablePath:process.env.DEMO_BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),external=[],errors=[];
 try{
  await context.route('**/*',route=>{
   const url=route.request().url();if(new URL(url).origin!==origin){external.push(url);return route.abort()}
   return route.continue();
  });
  await context.addInitScript(()=>{
   window.__demoStorageAccess=[];
   for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:true,get(){window.__demoStorageAccess.push(name);throw Error('Demo accessed '+name)}});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(origin+'/');await page.waitForFunction(()=>document.body.dataset.journalState==='ready'&&window.JournalCloud?.demo);
  assert.equal(await page.locator('#total').textContent(),'20h 00m');assert.equal(await page.locator('#count').textContent(),'6');assert.equal(await page.locator('#appCount').textContent(),'2');
  assert.match(await page.locator('#demoBanner').textContent(),/DEMO.*fictitious/);
  assert.equal(await page.locator('#demoEditLink').getAttribute('href'),origin+'/?edit=1');
  for(const id of ['connect','refresh','signout','settings','shareView','privateAccess','backup','import','legacyBackup','migrate','email','eml','createPrivateLink','refreshPrivateLinks','accessExpiry'])assert.equal(await page.locator('#'+id).isVisible(),false,id+' must be hidden in the demo');
  await page.locator('#add').click();await page.locator('[name="activity"]').fill('[DEMO] Temporary activity');await page.locator('[name="mins"]').fill('30');
  await page.locator('#editForm button[type="submit"]').click();await page.locator('#editor').waitFor({state:'hidden'});
  assert.equal(await page.locator('#total').textContent(),'20h 30m');assert.equal(await page.locator('#count').textContent(),'7');
  assert.equal(await page.locator('#signout').isVisible(),false,'Rendering after a save must not expose private controls');
  await page.locator('#applicationTab').click();await page.locator('#add').click();await page.locator('[name="function"]').fill('[DEMO] Temporary role');await page.locator('[name="company"]').fill('Fictional test company');
  await page.locator('#editForm button[type="submit"]').click();await page.locator('#editor').waitFor({state:'hidden'});
  assert.equal(await page.locator('#appCount').textContent(),'3');assert.equal(await page.locator('#total').textContent(),'20h 30m');
  await page.locator('article').filter({hasText:'[DEMO] Temporary role'}).locator('[data-delete]').click();await page.waitForFunction(()=>document.querySelector('#appCount').textContent==='2');
  const other=await context.newPage();other.on('pageerror',error=>errors.push(error.message));await other.goto(origin+'/');await other.waitForFunction(()=>document.body.dataset.journalState==='ready');
  assert.equal(await other.locator('#total').textContent(),'20h 00m','A second page must start with its own sample records');assert.deepEqual(await other.evaluate(()=>window.__demoStorageAccess),[]);await other.close();
  await page.locator('#allData').click();assert.match(await page.locator('#reportText').textContent(),/DEMONSTRATION — FICTIONAL DATA/);assert.match(await page.locator('#reportText').textContent(),/TOTAL TIME: 40h 30m/);
  assert.equal(await page.locator('.email-section').isVisible(),false);
  const csv=await download(page,'csv');assert.match(csv.toString('utf8'),/DEMONSTRATION — FICTIONAL DATA/);
  const xlsx=await download(page,'excel');assert.equal(xlsx.subarray(0,2).toString(),'PK');assert.match(xlsx.toString('utf8'),/DEMO — fictional records/);
  const pdf=await download(page,'pdf');assert.ok((await PDFDocument.load(pdf)).getPageCount()>0);
  await page.locator('[data-close="reportDialog"]').click();await page.locator('#resetDemo').click();await page.waitForFunction(()=>document.querySelector('#total').textContent==='20h 00m');
  assert.equal(await page.locator('#count').textContent(),'6');assert.equal(await page.locator('body').textContent().then(text=>text.includes('Temporary activity')),false);
  await page.locator('#add').click();await page.locator('[name="activity"]').fill('[DEMO] Unsaved draft');await page.locator('[data-close="editor"]').click();
  assert.deepEqual(await page.evaluate(()=>window.__demoStorageAccess),[]);
  await page.reload();await page.waitForFunction(()=>document.body.dataset.journalState==='ready');await page.locator('#add').click();
  assert.equal(await page.locator('[name="activity"]').inputValue(),'','Reload must not restore a demo draft');await page.locator('[data-close="editor"]').click();
  await page.setViewportSize({width:375,height:812});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Demo must fit a mobile viewport');
  assert.deepEqual(await page.evaluate(()=>window.__demoStorageAccess),[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS demo browser: fictional startup, isolated local editing, hidden private controls, marked downloads, independent pages, reset/reload, no storage or external requests, mobile layout');
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{server.close();console.error(error);process.exitCode=1});
