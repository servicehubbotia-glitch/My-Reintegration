'use strict';
// Dependency-free OOXML writer. Inline strings are data, never executable formulas.
// Section order and headings follow the original Marsha workbook (Blad1).
// The original attachment is private and is never bundled with the application.
window.JournalExcel = (()=>{
 const enc=new TextEncoder();
 const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const header='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const col=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
 const day=s=>({value:(Date.parse(s+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000,style:2});
 function sheet(rows,widths,headings,merges){return header+`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>`+widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')+'</cols><sheetData>'+rows.map((row,i)=>`<row r="${i+1}" ht="${headings.has(i+1)?56:42}" customHeight="1">`+row.map((v,j)=>{const ref=col(j)+(i+1),s=headings.has(i+1)?1:typeof v==='object'?v.style||0:0;return typeof v==='number'||v&&typeof v==='object'?`<c r="${ref}" s="${s}" t="n"><v>${typeof v==='number'?v:v.value}</v></c>`:`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`}).join('')+'</row>').join('')+`</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`}
 const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 function crc(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
 function zip(files){const parts=[],central=[];let offset=0;const u16=(v,n,x)=>v.setUint16(n,x,true),u32=(v,n,x)=>v.setUint32(n,x,true);
  for(const [name,text] of Object.entries(files)){const n=enc.encode(name),d=enc.encode(text),c=crc(d),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x800);u32(v,14,c);u32(v,18,d.length);u32(v,22,d.length);u16(v,26,n.length);h.set(n,30);parts.push(h,d);const z=new Uint8Array(46+n.length),w=new DataView(z.buffer);u32(w,0,0x02014b50);u16(w,4,20);u16(w,6,20);u16(w,8,0x800);u32(w,16,c);u32(w,20,d.length);u32(w,24,d.length);u16(w,28,n.length);u32(w,42,offset);z.set(n,46);central.push(z);offset+=h.length+d.length}
  const size=central.reduce((s,v)=>s+v.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);u32(e,0,0x06054b50);u16(e,8,central.length);u16(e,10,central.length);u32(e,12,size);u32(e,16,offset);return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
 function create(activities,applications,range,recipient=''){
 const rows=[['Reintegration Activities Log'],[range],['Ongoing Applications'],['Date of application','function','company','via','conversation','interview date','with whom (did you speak)',"contact person's phone number",'result (accepted/rejected) and reason']];
 applications.forEach(r=>rows.push([day(r.date),r.function,r.company,r.via,r.conversation,r.interview?day(r.interview):'',r.withWhom,r.phone,r.result]));
 while(rows.length<16)rows.push([]);
 const section=rows.length+1;rows.push(['Activity']);
 rows.push(['What activity did you do?','Date','What was the result/outcome of this activity for you?','','','Result (Completed Yes or No)','Duration',recipient?'Mail to '+recipient:'Mail to Marsha','']);
 const start=rows.length+1;
 activities.forEach(r=>rows.push([r.activity,day(r.date),r.outcome,'','',r.completed,{value:r.minutes/1440,style:3},r.mail,'']));
 while(rows.length<start+11)rows.push([]);
 const end=rows.length;
 rows.push(['Total weekly hours','','','','','',{value:activities.reduce((s,r)=>s+r.minutes,0)/1440,style:3}]);
 rows.push(['','Mail every Friday before 1700 hours'],['',recipient]);
 const merges=['A1:I1','A2:I2','A3:I3',`A${section}:I${section}`];
 for(let r=section+1;r<=end;r++)merges.push(`C${r}:E${r}`,`H${r}:I${r}`);
 const headings=new Set([1,3,4,section,section+1]);
 return zip({
 '[Content_Types].xml':header+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':header+`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Blad1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':header+`<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="[h]:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEE8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
 'xl/worksheets/sheet1.xml':sheet(rows,[32,18,20,15,20,24,18,25,28],headings,merges)});
 }
 return {create};
})();
