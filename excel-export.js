'use strict';
// Dependency-free OOXML writer. Inline strings are data, never executable formulas.
// Section order and headings follow the original reporting workbook (Blad1).
// The original attachment is private and is never bundled with the application.
window.JournalExcel = (()=>{
 const enc=new TextEncoder();
 const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const header='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
 const day=s=>({value:(Date.parse(s+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000,style:2});
 const widths=[32,18,20,15,20,24,18,25,28];
 const columnIndex=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
 // Conservative wrapping for Calibri 11, including explicit line breaks. Keep
 // every original character so continuation rows can be joined without loss.
 function wrappedLines(value,width){
  const limit=Math.max(4,Math.floor(width*.85-2)),lines=[];
  const units=s=>[...s].reduce((n,c)=>n+(c==='\t'?4:/[\u2e80-\uffff]/u.test(c)?2:1),0);
  let line='',used=0;
  for(const token of String(value??'').match(/\r\n|[\r\n]|[^\S\r\n]+|\S+/gu)||[]){
   if(/^[\r\n]/.test(token)){lines.push(line+token);line='';used=0;continue}
   if(!/^\s/.test(token)&&line&&used+units(token)>limit){lines.push(line);line='';used=0}
   for(const c of token){const size=units(c);if(line&&used+size>limit){lines.push(line);line='';used=0}line+=c;used+=size}
  }
  lines.push(line);return lines;
 }
 function rowHeight(row,widthAt,isHeading){return Math.min(409.5,Math.max(isHeading?56:42,...row.map((v,j)=>typeof v==='string'?wrappedLines(v,widthAt(j)).length*15+10:0)))}
 function sheet(rows,headings,merges){
  const mergedWidths=new Map();
  for(const ref of merges){const m=ref.match(/^([A-Z]+)(\d+):([A-Z]+)\d+$/),first=columnIndex(m[1]),last=columnIndex(m[3]);mergedWidths.set(`${m[2]}:${first}`,widths.slice(first,last+1).reduce((s,w)=>s+w,0))}
  return header+`<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>`+widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols><sheetData>'+rows.map((row,i)=>`<row r="${i+1}" ht="${rowHeight(row,j=>mergedWidths.get(`${i+1}:${j}`)||widths[j],headings.has(i+1))}" customHeight="1">`+row.map((v,j)=>{const ref=col(j)+(i+1),s=headings.has(i+1)?1:typeof v==='object'?v.style||0:0;return typeof v==='number'||v&&typeof v==='object'?`<c r="${ref}" s="${s}" t="n"><v>${typeof v==='number'?v:v.value}</v></c>`:`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`}).join('')+'</row>').join('')+`</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
 }
 const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 function crc(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
 function zip(files){const parts=[],central=[];let offset=0;const u16=(v,n,x)=>v.setUint16(n,x,true),u32=(v,n,x)=>v.setUint32(n,x,true);
  for(const [name,text] of Object.entries(files)){const n=enc.encode(name),d=enc.encode(text),c=crc(d),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x800);u32(v,14,c);u32(v,18,d.length);u32(v,22,d.length);u16(v,26,n.length);h.set(n,30);parts.push(h,d);const z=new Uint8Array(46+n.length),w=new DataView(z.buffer);u32(w,0,0x02014b50);u16(w,4,20);u16(w,6,20);u16(w,8,0x800);u32(w,16,c);u32(w,20,d.length);u32(w,24,d.length);u16(w,28,n.length);u32(w,42,offset);z.set(n,46);central.push(z);offset+=h.length+d.length}
  const size=central.reduce((s,v)=>s+v.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);u32(e,0,0x06054b50);u16(e,8,central.length);u16(e,10,central.length);u32(e,12,size);u32(e,16,offset);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
 function create(activities,applications,range,recipient='',options={}){
 const allDates=options.period==='all';
 const rows=[[allDates?'Reintegration Activities Log — Full record':'Reintegration Activities Log'],[range],['Ongoing Applications'],['Date of application','function','company','via','conversation','interview date','with whom (did you speak)',"contact person's phone number",'result (accepted/rejected) and reason']];
 const merges=['A1:I1','A2:I2','A3:I3'];
 // Excel limits a row to 409.5 points. Very long cells continue on the next
 // physical row; dates, statuses and duration occur once, so totals stay exact.
 function appendData(row,spans=[]){
  const widthAt=j=>{const span=spans.find(([first])=>first===j);return span?widths.slice(span[0],span[1]+1).reduce((s,w)=>s+w,0):widths[j]};
  const parts=row.map((v,j)=>{if(typeof v!=='string')return[v];const lines=wrappedLines(v,widthAt(j)),chunks=[];for(let i=0;i<lines.length;i+=23)chunks.push(lines.slice(i,i+23).join(''));return chunks});
  const count=Math.max(...parts.map(p=>p.length));
  for(let i=0;i<count;i++){rows.push(parts.map(p=>p[i]??''));for(const [first,last] of spans)merges.push(`${col(first)}${rows.length}:${col(last)}${rows.length}`)}
 }
 applications.forEach(r=>appendData([day(r.date),r.function,r.company,r.via,r.conversation,r.interview?day(r.interview):'',r.withWhom,r.phone,r.result]));
 while(rows.length<16)rows.push([]);
 const section=rows.length+1;rows.push(['Activity']);
 rows.push(['What activity did you do?','Date','What was the result/outcome of this activity for you?','','','Result (Completed Yes or No)','Duration',recipient?'Mail to '+recipient:'Mail to report recipient','']);
 const start=rows.length+1;
 const activitySpans=[[2,4],[7,8]];
 merges.push(`A${section}:I${section}`,`C${section+1}:E${section+1}`,`H${section+1}:I${section+1}`);
 activities.forEach(r=>appendData([r.activity,day(r.date),r.outcome,'','',r.completed,{value:r.minutes/1440,style:3},r.mail,''],activitySpans));
 while(rows.length<start+11){rows.push([]);for(const [first,last] of activitySpans)merges.push(`${col(first)}${rows.length}:${col(last)}${rows.length}`)}
 rows.push([allDates?'Total recorded hours':'Total weekly hours','','','','','',{value:activities.reduce((s,r)=>s+r.minutes,0)/1440,style:3}]);
 if(!allDates){rows.push(['','Mail every Friday before 1700 hours']);merges.push(`B${rows.length}:I${rows.length}`)}
 if(recipient){rows.push(['',recipient]);merges.push(`B${rows.length}:I${rows.length}`)}
 const headings=new Set([1,3,4,section,section+1]);
 return zip({
 '[Content_Types].xml':header+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':header+`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Blad1" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Blad1'!$A$1:$I$${rows.length}</definedName></definedNames></workbook>`,
 'xl/_rels/workbook.xml.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':header+`<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="[h]:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEE8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
 'xl/worksheets/sheet1.xml':sheet(rows,headings,merges)});
 }
 return {create};
})();
