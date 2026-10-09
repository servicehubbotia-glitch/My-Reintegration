// Isolated fixtures only; no access to the real spreadsheet.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{},TextEncoder,Blob};vm.createContext(ctx);vm.runInContext(fs.readFileSync('excel-export.js','utf8'),ctx);
(async()=>{const activities=[{date:'2026-10-10',activity:'=1+1',outcome:'A & B < C',completed:'No',minutes:95,mail:'No'},{date:'2026-10-11',activity:'Weekend',outcome:'',completed:'Yes',minutes:50,mail:'Yes'}];
 const applications=[{date:'2026-10-09',function:'Test role',company:'Test company',via:'',conversation:'',interview:'',withWhom:'',phone:'+310000',result:''}];
 fs.mkdirSync('test-results',{recursive:true});const blob=ctx.window.JournalExcel.create(activities,applications,'5–11 October 2026','reviewer@example.invalid');assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');const bytes=Buffer.from(await blob.arrayBuffer());fs.writeFileSync('test-results/template-export.xlsx',bytes);
 // The generated Apps Script inline exporter must compile and preserve the workbook bytes.
 const inline=[...fs.readFileSync('apps-script-guest/View.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('window.JournalExcel'));
 assert.ok(inline);assert.ok(!inline.includes('http://'),'Escape XML namespace slashes for HTMLService');
 const guest={window:{},TextEncoder,Blob};vm.createContext(guest);vm.runInContext(inline,guest);
 const guestBlob=guest.window.JournalExcel.create(activities,applications,'5–11 October 2026','reviewer@example.invalid');assert.deepEqual(Buffer.from(await guestBlob.arrayBuffer()),bytes);
 console.log('PASS Excel fixture and generated HTMLService exporter produce identical workbooks');})();
