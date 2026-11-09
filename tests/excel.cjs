// Isolated fixtures only; no access to the real spreadsheet.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{},TextEncoder,Blob};vm.createContext(ctx);vm.runInContext(fs.readFileSync('excel-export.js','utf8'),ctx);
function readZip(bytes){
 const files=new Map();let p=0;
 while(bytes.readUInt32LE(p)===0x04034b50){
  assert.equal(bytes.readUInt16LE(p+8),0,'Fixture ZIP entries use store compression');
  const size=bytes.readUInt32LE(p+18),nameSize=bytes.readUInt16LE(p+26),extraSize=bytes.readUInt16LE(p+28),start=p+30+nameSize+extraSize;
  files.set(bytes.subarray(p+30,p+30+nameSize).toString(),bytes.subarray(start,start+size).toString());p=start+size;
 }
 assert.equal(bytes.readUInt32LE(p),0x02014b50,'ZIP has a central directory');return files;
}
const unxml=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,c=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[c]));
function worksheet(bytes){
 const files=readZip(bytes),xml=files.get('xl/worksheets/sheet1.xml'),rows=[];
 for(const m of xml.matchAll(/<row r="(\d+)" ht="([\d.]+)"[^>]*>([\s\S]*?)<\/row>/g)){
  const cells={};for(const c of m[3].matchAll(/<c r="([A-Z]+)\d+"[^>]*t="([^"]+)"[^>]*>([\s\S]*?)<\/c>/g))cells[c[1]]=c[2]==='n'?Number(c[3].match(/<v>([^<]*)<\/v>/)[1]):unxml(c[3].match(/<t[^>]*>([\s\S]*?)<\/t>/)[1]);
  rows.push({number:Number(m[1]),height:Number(m[2]),cells});
 }
 return{files,xml,rows};
}
(async()=>{const activities=[{date:'2026-10-10',activity:'=1+1',outcome:'A & B < C',completed:'No',minutes:95,mail:'No'},{date:'2026-10-11',activity:'Weekend',outcome:'',completed:'Yes',minutes:50,mail:'Yes'}];
 const applications=[{date:'2026-10-09',function:'Test role',company:'Test company',via:'',conversation:'',interview:'',withWhom:'',phone:'+310000',result:''}];
 fs.mkdirSync('test-results',{recursive:true});const blob=ctx.window.JournalExcel.create(activities,applications,'5–11 October 2026','reviewer@example.invalid');assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');const bytes=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('test-results/template-export.xlsx',bytes);
 const weekly=worksheet(bytes),weeklyTotal=weekly.rows.find(r=>r.cells.A==='Total weekly hours');
 assert.equal(weeklyTotal.cells.G,145/1440);assert.equal(weekly.rows.find(r=>r.cells.A==='=1+1').cells.C,'A & B < C');assert.ok(!weekly.xml.includes('<f>'),'User text is never a formula');
 assert.ok(weekly.xml.includes('fitToPage="1"'));assert.ok(weekly.files.get('xl/workbook.xml').includes('_xlnm.Print_Area'));
 const longOutcome=('Completed a practical training task, reviewed the results and recorded the next steps. ').repeat(10);
 const veryLongOutcome=('Detailed notes with accents áéíóú, Unicode 中文, ampersands & and <angle brackets>.\n').repeat(75);
 const longFunction='Application support and technical integration specialist '.repeat(25);
 const longActivities=[{...activities[0],activity:'Long practical activity description '.repeat(6),outcome:longOutcome},{...activities[1],outcome:veryLongOutcome,date:'2026-10-20'}];
 const longApplications=[{...applications[0],function:longFunction}];
 const allBytes=Buffer.from(await ctx.window.JournalExcel.create(longActivities,longApplications,'10–20 October 2026','',{period:'all'}).arrayBuffer());
 fs.writeFileSync('test-results/full-record-export.xlsx',allBytes);
 const full=worksheet(allBytes),activitySection=full.rows.find(r=>r.cells.A==='Activity').number,fullTotal=full.rows.find(r=>r.cells.A==='Total recorded hours');
 assert.ok(full.rows[0].cells.A.endsWith('Full record'));assert.ok(!full.xml.includes('Total weekly hours'));assert.ok(!full.xml.includes('Mail every Friday'));
 assert.equal(fullTotal.cells.G,145/1440,'All-date total counts each activity once');
 const exportedActivities=full.rows.filter(r=>r.number>activitySection+1&&r.number<fullTotal.number);
 assert.equal(exportedActivities.map(r=>r.cells.A||'').join(''),longActivities.map(r=>r.activity).join(''),'Continuation rows retain complete activity text');
 assert.equal(exportedActivities.map(r=>r.cells.C||'').join(''),longOutcome+veryLongOutcome,'Continuation rows retain complete outcomes');
 assert.equal(exportedActivities.filter(r=>typeof r.cells.G==='number').length,2,'Continuation rows never repeat durations');
 assert.equal(full.rows.filter(r=>r.number>4&&r.number<activitySection).map(r=>r.cells.B||'').join(''),longFunction,'Long application details are not clipped or lost');
 assert.ok(exportedActivities.some(r=>r.height>200),'Long text receives sufficient row height');
 assert.ok(full.rows.every(r=>r.height<=409.5),'Every row respects the Excel height limit');
 const merged=[...full.xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)],occupied=new Set();
 for(const m of merged){assert.equal(m[2],m[4]);for(let c=m[1].charCodeAt(0);c<=m[3].charCodeAt(0);c++){const key=m[2]+':'+c;assert.ok(!occupied.has(key),'Merge ranges never overlap');occupied.add(key)}}
 for(const r of exportedActivities)assert.ok(full.xml.includes(`ref="C${r.number}:E${r.number}"`),'Outcome merge follows every continuation row');
 console.log('PASS weekly and full-period exports: totals, typed cells, long-text continuation, bounded row heights, print setup and non-overlapping merges');
 // The generated Apps Script inline exporter must compile and preserve the workbook bytes.
 const inline=[...fs.readFileSync('apps-script-guest/View.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.JournalExcel'));
 assert.ok(inline);assert.ok(!inline.includes('http://'),'Escape XML namespace slashes for HTMLService');
 const guest={window:{},TextEncoder,Blob};vm.createContext(guest);vm.runInContext(inline,guest);
 const guestBlob=guest.window.JournalExcel.create(activities,applications,'5–11 October 2026','reviewer@example.invalid');assert.ok(Buffer.from(await guestBlob.arrayBuffer()).equals(bytes),'Generated guest exporter differs from source; rebuild apps-script-guest/View.html');
 console.log('PASS Excel fixture and generated HTMLService exporter produce identical workbooks');})().catch(e=>{console.error(e);process.exitCode=1});
