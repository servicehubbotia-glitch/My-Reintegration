const TABLES_ = {
 activities: {name:'Activities',fields:['id','date','activity','category','outcome','completed','minutes','mail','createdAt','updatedAt'],headers:['ID','Date','Activity','Category','Outcome','Completed (Yes/No)','Duration (minutes)','Mail to Marsha (Yes/No)','Created at','Updated at']},
 applications: {name:'Applications',fields:['id','date','function','company','via','conversation','interview','withWhom','phone','result','createdAt','updatedAt'],headers:['ID','Date of application','Function','Company','Via','Conversation','Interview date','With whom (did you speak)',"Contact person's phone number",'Result (accepted/rejected) and reason','Created at','Updated at']}
};
function fail_(code,message){const e=new Error(message);e.journalCode=code;throw e}
function cell_(v){return {userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v??'')}}}
function writeRow_(sheetId,row,values){return {updateCells:{start:{sheetId,rowIndex:row,columnIndex:0},rows:[{values:values.map(cell_)}],fields:'userEnteredValue'}}}
function load_(id){
 const meta=Sheets.Spreadsheets.get(id,{fields:'sheets(properties(sheetId,title))'}),sheetIds={};
 for(const k in TABLES_){const s=meta.sheets.find(s=>s.properties.title===TABLES_[k].name);if(!s)fail_('SCHEMA','A required sheet is missing.');sheetIds[k]=s.properties.sheetId}
 const settingsId=meta.sheets.find(s=>s.properties.title==='Settings')?.properties.sheetId;if(settingsId===undefined)fail_('SCHEMA','Settings sheet is missing.');
 const ranges=["'Activities'!A:J","'Applications'!A:L","'Settings'!A:C"];
 const values=Sheets.Spreadsheets.Values.batchGet(id,{ranges,valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'}).valueRanges;
 const result={sheetIds,settingsId};
 Object.keys(TABLES_).forEach((k,i)=>{
  const table=TABLES_[k],all=values[i].values||[];
  if(JSON.stringify(all[0])!==JSON.stringify(table.headers))fail_('SCHEMA','Unexpected column headings in '+table.name+'.');
  result[k]=all.slice(1).map((r,i)=>({r,row:i+1})).filter(x=>x.r.some(v=>v!==''&&v!==null)).map(({r,row})=>{
   const record=Object.fromEntries(table.fields.map((f,j)=>[f,r[j]??'']));
   for(const f of ['date','interview'])if(typeof record[f]==='number')record[f]=new Date(Math.round((record[f]-25569)*86400000)).toISOString().slice(0,10);
   validateRecord_(k,record);return {...record,_row:row};
  });
  if(new Set(result[k].map(r=>r.id)).size!==result[k].length)fail_('SCHEMA','Duplicate record identifiers in '+table.name+'.');
 });
 const sr=values[2].values||[];if(JSON.stringify(sr[0])!==JSON.stringify(['Key','Value','Updated at']))fail_('SCHEMA','Unexpected Settings headings.');
 result.settingsRows=sr.slice(1);const get=(key,fallback)=>result.settingsRows.find(r=>r[0]===key)?.[1]??fallback;
 result.settings={goal:Number(get('Weekly goal',20)),recipient:String(get('Report recipient','')),name:String(get('User display name',''))};validateSettings_(result.settings);
 result.revision=hash_({activities:result.activities,applications:result.applications,settings:result.settings});return result;
}
function snapshot_(loaded,access){const clean=rows=>rows.map(({_row,...r})=>r);return {role:access.role,identity:access.email,revision:loaded.revision,data:{version:1,settings:loaded.settings,activities:clean(loaded.activities),applications:clean(loaded.applications)}}}
function hash_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(v)).map(b=>(b&255).toString(16).padStart(2,'0')).join('')}
function validId_(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(v)}
function validDate_(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v}
function validateRecord_(kind,r){
 const fields=TABLES_[kind].fields.filter(f=>!['createdAt','updatedAt'].includes(f));
 if(!r||!validId_(r.id)||!validDate_(r.date))fail_('INVALID','Invalid record ID or date.');
 if(fields.some(f=>f!=='minutes'&&(typeof r[f]!=='string'||r[f].length>20000)))fail_('INVALID','Invalid record field.');
 if(kind==='activities'&&(!r.activity.trim()||!Number.isSafeInteger(r.minutes)||r.minutes<0||r.minutes>10080||!['Yes','No'].includes(r.completed)||!['Yes','No'].includes(r.mail)))fail_('INVALID','Invalid activity.');
 if(kind==='applications'&&(!r.function.trim()||!r.company.trim()||(r.interview&&!validDate_(r.interview))))fail_('INVALID','Invalid application.');
}
function validateSettings_(s){if(!s||!Number.isFinite(s.goal)||s.goal<.25||s.goal>168||typeof s.name!=='string'||s.name.length>200||typeof s.recipient!=='string'||s.recipient.length>320||s.recipient&& !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.recipient))fail_('INVALID','Invalid settings.')}

// Shared private helpers. The registry stores hashes only, never bearer tokens.
const ACCESS_HEADERS_=['Access ID','Token hash','Expires at','Revoked at','Created at'];
const LOG_HEADERS_=['Timestamp','Access ID','Operation','Result'];
function accessSheets_(id,create){
 const meta=Sheets.Spreadsheets.get(id,{fields:'sheets(properties(sheetId,title))'});
 const out={};
 for(const [name,headers] of [['AccessGrants',ACCESS_HEADERS_],['AccessLog',LOG_HEADERS_]]){
  let sheet=meta.sheets.find(s=>s.properties.title===name);
  if(!sheet&&create){
   const response=Sheets.Spreadsheets.batchUpdate({requests:[{addSheet:{properties:{title:name}}}]},id);
   sheet={properties:response.replies[0].addSheet.properties};
   Sheets.Spreadsheets.batchUpdate({requests:[writeRow_(sheet.properties.sheetId,0,headers)]},id);
  }
  if(!sheet)fail_('SETUP_REQUIRED','Private access has not been configured.');
  const rows=Sheets.Spreadsheets.Values.get(id,"'"+name+"'!"+(name==='AccessGrants'?'A:E':'A1:D1'),{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
  if(JSON.stringify(rows[0])!==JSON.stringify(headers))fail_('SCHEMA','Invalid private access configuration.');
  out[name]={sheetId:sheet.properties.sheetId,rows:rows.slice(1)};
 }
 return out;
}
function accessLog_(id,sheetId,accessId,operation,allowed){
 Sheets.Spreadsheets.batchUpdate({requests:[{appendCells:{sheetId,rows:[{values:[new Date().toISOString(),accessId,operation,allowed?'authorized':'rejected'].map(cell_)}],fields:'userEnteredValue'}}]},id);
}
function equalHash_(a,b){let diff=a.length^b.length;for(let i=0;i<64;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}

