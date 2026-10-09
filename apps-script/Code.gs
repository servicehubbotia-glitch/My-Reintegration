/** API executable only. No doGet/doPost and no anonymous web app deployment.
 * Set SPREADSHEET_ID, OWNER_EMAIL in Script Properties using the Google console.
 * READER_EMAILS is an optional JSON array, empty by default. Never ship identities.
 * Enable advanced Sheets v4 and Drive v3 services in this same project.
 */
const TABLES_ = {
 activities: {name:'Activities',fields:['id','date','activity','category','outcome','completed','minutes','mail','createdAt','updatedAt'],headers:['ID','Date','Activity','Category','Outcome','Completed (Yes/No)','Duration (minutes)','Mail to Marsha (Yes/No)','Created at','Updated at']},
 applications: {name:'Applications',fields:['id','date','function','company','via','conversation','interview','withWhom','phone','result','createdAt','updatedAt'],headers:['ID','Date of application','Function','Company','Via','Conversation','Interview date','With whom (did you speak)',"Contact person's phone number",'Result (accepted/rejected) and reason','Created at','Updated at']}
};
// This is the only public executable function. Helper names end in underscore.
function journal(request) {
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return {ok:false,code:'BUSY',message:'Another save is in progress. Retry with the same request.'};
 try {
  const access=authorize_();
  if(request?.action==='access')return manageAccess_(access,request);
  if(!request||!['read','commit'].includes(request.action))fail_('INVALID','Unknown operation.');
  const loaded=load_(access.id);
  if(request.action==='read')return {ok:true,...snapshot_(loaded,access)};
  if(access.role!=='owner')fail_('FORBIDDEN','This account has read-only access.');
  if(!/^[a-zA-Z0-9-]{12,100}$/.test(request.requestId||''))fail_('INVALID','Invalid request identifier.');
  if(!Array.isArray(request.mutations)||!request.mutations.length||request.mutations.length>50)fail_('INVALID','Send between 1 and 50 changes.');
  const fingerprint=hash_({revision:request.revision,mutations:request.mutations});
  const previous=loaded.settingsRows.find(r=>r[0]==='_op:'+request.requestId);
  if(previous){if(previous[1]!==fingerprint)fail_('CONFLICT','Request identifier was already used.');return {ok:true,replayed:true,...snapshot_(loaded,access)}}
  if(request.revision!==loaded.revision)fail_('CONFLICT','Records have changed. Refresh and review your pending changes.');
  const now=new Date().toISOString(), requests=[],seen=new Set();
  // Validate the complete batch before creating any write request.
  request.mutations.forEach(m=>{
   if(!m||!['put','delete','settings'].includes(m.type))fail_('INVALID','Invalid change.');
   const key=m.type==='settings'?'settings':m.kind+':'+(m.record?.id||m.id);
   if(seen.has(key))fail_('INVALID','Duplicate change in one batch.');seen.add(key);
   if(m.type==='settings'){validateSettings_(m.settings);return}
   if(!Object.prototype.hasOwnProperty.call(TABLES_,m.kind))fail_('INVALID','Unknown collection.');
   if(m.type==='put')validateRecord_(m.kind,m.record);else if(!validId_(m.id))fail_('INVALID','Invalid record identifier.');
  });
  const rowDeletes=[];
  request.mutations.forEach(m=>{
   if(m.type==='settings'){
    [['Weekly goal',m.settings.goal],['Report recipient',m.settings.recipient],['User display name',m.settings.name]].forEach(([key,value])=>{
     const idx=loaded.settingsRows.findIndex(r=>r[0]===key);
     if(idx<0)fail_('SCHEMA','Settings rows are missing.');
     requests.push(writeRow_(loaded.settingsId,idx+1,[key,value,now]));
    });return;
   }
   const table=TABLES_[m.kind],rows=loaded[m.kind],idx=rows.findIndex(r=>r.id===(m.record?.id||m.id));
   if(m.type==='delete'){if(idx>=0)rowDeletes.push({sheetId:loaded.sheetIds[m.kind],row:rows[idx]._row});return}
   const clean=Object.fromEntries(table.fields.map(k=>[k,m.record[k]??'']));
   clean.createdAt=idx>=0?rows[idx].createdAt:now;clean.updatedAt=now;
   const values=table.fields.map(k=>clean[k]);
   if(idx>=0)requests.push(writeRow_(loaded.sheetIds[m.kind],rows[idx]._row,values));
   else requests.push({appendCells:{sheetId:loaded.sheetIds[m.kind],rows:[{values:values.map(cell_)}],fields:'userEnteredValue'}});
  });
  rowDeletes.sort((a,b)=>b.row-a.row).forEach(d=>requests.push({deleteDimension:{range:{sheetId:d.sheetId,dimension:'ROWS',startIndex:d.row,endIndex:d.row+1}}}));
  // Idempotency receipt and data changes share the same atomic Sheets batch.
  requests.push({appendCells:{sheetId:loaded.settingsId,rows:[{values:['_op:'+request.requestId,fingerprint,now].map(cell_)}],fields:'userEnteredValue'}});
  Sheets.Spreadsheets.batchUpdate({requests},access.id);
  return {ok:true,...snapshot_(load_(access.id),access)};
 } catch(e){return {ok:false,code:e.journalCode||'SERVICE_ERROR',message:e.journalCode?e.message:'The Google service could not complete the request. Pending changes are retained.'}}
 finally {lock.releaseLock()}
}
function fail_(code,message){const e=new Error(message);e.journalCode=code;throw e}
function authorize_(){
 const props=PropertiesService.getScriptProperties();const id=props.getProperty('SPREADSHEET_ID'),owner=(props.getProperty('OWNER_EMAIL')||'').trim().toLowerCase();
 const email=(Session.getEffectiveUser().getEmail()||'').toLowerCase();
 if(!id||!owner)fail_('SETUP_REQUIRED','The Google service has not been configured.');
 const readers=JSON.parse(props.getProperty('READER_EMAILS')||'[]');
 if(!email||!(email===owner||readers.includes(email)))fail_('FORBIDDEN','This Google account is not authorized.');
 const file=Drive.Files.get(id,{fields:'id,mimeType,owners(emailAddress),capabilities(canEdit)'});
 if(file.mimeType!=='application/vnd.google-apps.spreadsheet'||!file.owners?.some(o=>o.emailAddress.toLowerCase()===owner))fail_('FORBIDDEN','Spreadsheet ownership does not match configuration.');
 let pageToken;do{const p=Drive.Permissions.list(id,{fields:'permissions(type,role,emailAddress),nextPageToken',pageToken:pageToken||undefined});
  if(p.permissions.some(p=>p.type==='anyone'||p.type==='domain'))fail_('PUBLIC_SHARING','Set this spreadsheet to Restricted before connecting.');pageToken=p.nextPageToken;
 }while(pageToken);
 if(email===owner&&!file.capabilities.canEdit)fail_('FORBIDDEN','Owner write permission is missing.');
 return {id,role:email===owner?'owner':'reader',email};
}
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

function manageAccess_(access,r){
 if(access.role!=='owner')fail_('FORBIDDEN','Only the owner can manage private access.');
 if(!['list','create','revoke'].includes(r.operation))fail_('INVALID','Unknown access operation.');
 const db=accessSheets_(access.id,true),rows=db.AccessGrants.rows;
 const now=new Date().toISOString();
 if(r.operation==='create'){
  if(!validId_(r.id)||!/^[a-f0-9]{64}$/.test(r.digest||''))fail_('INVALID','Invalid access identifier or digest.');
  const expiry=Date.parse(r.expiresAt);
  if(!Number.isFinite(expiry)||new Date(expiry).toISOString()!==r.expiresAt||expiry<=Date.now()||expiry>Date.now()+366*86400000)fail_('INVALID','Choose an expiry within the next year.');
  const existing=rows.find(row=>row[0]===r.id);
  if(existing){if(existing[1]!==r.digest||existing[2]!==r.expiresAt)fail_('CONFLICT','Access identifier already exists.');}
  else{
   if(rows.some(row=>row[1]===r.digest))fail_('CONFLICT','Use a new access token.');
   Sheets.Spreadsheets.batchUpdate({requests:[{appendCells:{sheetId:db.AccessGrants.sheetId,rows:[{values:[r.id,r.digest,r.expiresAt,'',now].map(cell_)}],fields:'userEnteredValue'}}]},access.id);
  }
 }
 if(r.operation==='revoke'){
  const i=rows.findIndex(row=>row[0]===r.id);if(i<0)fail_('INVALID','Access identifier was not found.');
  if(!rows[i][3])Sheets.Spreadsheets.batchUpdate({requests:[writeRow_(db.AccessGrants.sheetId,i+1,[...rows[i].slice(0,3),now,rows[i][4]])]},access.id);
 }
 const fresh=accessSheets_(access.id,false);
 return {ok:true,grants:fresh.AccessGrants.rows.map(row=>({id:row[0],expiresAt:row[2],revokedAt:row[3]||'',createdAt:row[4]}))};
}
