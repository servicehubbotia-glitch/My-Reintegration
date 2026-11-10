// Isolated service doubles: no requests or synthetic records reach Google.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const token=crypto.randomBytes(32).toString('base64url'),otherToken=crypto.randomBytes(32).toString('base64url');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
let logFails=false,publicSharing=false,reads=0,sheetCalls=0,afterLoad=null,afterAudit=null,identity='owner@example.invalid';
const sheets={
 Activities:{id:201,rows:[]},Applications:{id:202,rows:[]},
 Settings:{id:203,rows:[['Key','Value','Updated at'],['Weekly goal',20],['Report recipient','owner-private@example.invalid'],['User display name','']]},
 AccessGrants:{id:204,rows:[['Access ID','Token hash','Expires at','Revoked at','Created at']]},
 AccessLog:{id:205,rows:[['Timestamp','Access ID','Operation','Result']]}
};
const context={
 Session:{getEffectiveUser:()=>({getEmail:()=>identity})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>({SPREADSHEET_ID:'isolated',OWNER_EMAIL:'owner@example.invalid',EDITOR_EMAILS:'["editor@example.invalid"]',READER_EMAILS:'["reader@example.invalid"]'}[k])})},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 Utilities:{DigestAlgorithm:{SHA_256:1},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()]},
 Drive:{
  Files:{get:()=>({mimeType:'application/vnd.google-apps.spreadsheet',owners:[{emailAddress:'owner@example.invalid'}],capabilities:{canEdit:true}})},
  Permissions:{list:()=>({permissions:publicSharing?[{type:'anyone'}]:[{type:'user'}]})}
 },
 Sheets:{Spreadsheets:{
  get:()=>{sheetCalls++;return {sheets:Object.entries(sheets).map(([title,s])=>({properties:{title,sheetId:s.id}}))}},
  Values:{
   get:(_,range)=>{sheetCalls++;const sheet=sheets[range.split("'")[1]];if(!sheet)throw Error('Missing sheet');return {values:structuredClone(sheet.rows)}},
   batchGet:()=>{sheetCalls++;reads++;const valueRanges=['Activities','Applications','Settings'].map(n=>({values:structuredClone(sheets[n].rows)}));if(afterLoad){const hook=afterLoad;afterLoad=null;hook()}return {valueRanges}}
  },
  batchUpdate:({requests})=>{sheetCalls++;for(const r of requests){
   const a=r.appendCells||r.updateCells,s=Object.values(sheets).find(x=>x.id===(a.sheetId??a.start.sheetId));
   if(s===sheets.AccessLog&&logFails)throw Error('Audit unavailable');
   const rows=a.rows.map(row=>row.values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue));
   if(r.appendCells)s.rows.push(...rows);else s.rows[a.start.rowIndex]=rows[0];
   if(s===sheets.AccessLog&&rows[0][3]==='authorized'&&afterAudit){const hook=afterAudit;afterAudit=null;hook()}
  }}
 }}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script-guest/ReadHelpers.gs','utf8')+fs.readFileSync('apps-script-guest/Guest.gs','utf8'),context);
sheets.Activities.rows=[vm.runInContext('TABLES_.activities.headers',context),
 ['synthetic-0001','2026-10-11','First isolated week','Other','Outcome','No',95,'No','2026-10-01','2026-10-01'],
 ['synthetic-0002','2026-11-02','Another isolated week','Other','Another outcome','Yes',60,'No','2026-11-02','2026-11-02']];
sheets.Applications.rows=[vm.runInContext('TABLES_.applications.headers',context),
 ['synthetic-application','2026-10-09','Test role','Example company','','Conversation','','Contact','Phone','Result','','']];
const grant=['synthetic-access',digest(token),new Date(Date.now()+86400000).toISOString(),'','2026-10-09'];
sheets.AccessGrants.rows.push(grant);
const call=(operation='read',credential=token)=>context.guestRequest({operation,token:credential,week:'2026-10-05'});
function deniedWithoutRecords(run){
 const before=reads,r=run();assert.equal(r.ok,false);assert.equal(r.data,undefined);assert.equal(reads,before);return r;
}

// Missing/malformed bearer credentials are rejected before even reading metadata.
for(const invalid of [undefined,null,'','short','a'.repeat(42),'a'.repeat(44),'='.repeat(43),' '+token,{},[]]){
 const before=sheetCalls;const r=deniedWithoutRecords(()=>context.guestRequest({operation:'read',token:invalid}));
 assert.equal(r.code,'FORBIDDEN');assert.equal(sheetCalls,before);
}
deniedWithoutRecords(()=>context.guestRequest({operation:'read',accessToken:token}));
assert.equal(deniedWithoutRecords(()=>call('read',otherToken)).code,'FORBIDDEN');
const future=grant[2];
for(const expiry of [new Date(Date.now()-1000).toISOString(),'not-a-date',0]){
 grant[2]=expiry;assert.equal(deniedWithoutRecords(()=>call()).code,'FORBIDDEN');
}
grant[2]=future;grant[3]=new Date().toISOString();assert.equal(deniedWithoutRecords(()=>call()).code,'FORBIDDEN');grant[3]='';
sheets.AccessGrants.rows.push([...grant]);assert.equal(deniedWithoutRecords(()=>call()).code,'FORBIDDEN');sheets.AccessGrants.rows.pop();
sheets.AccessGrants.rows.push([grant[0],digest(otherToken),future,'','']);assert.equal(deniedWithoutRecords(()=>call()).code,'FORBIDDEN');sheets.AccessGrants.rows.pop();

// Every valid operation retains the full history; week never narrows access.
for(const operation of ['read','report','export.pdf','export.xlsx','export.csv','export.copy']){
 const r=call(operation);assert.equal(r.ok,true);assert.equal(r.data.activities.length,2);assert.equal(r.data.applications.length,1);
 assert.equal(r.data.activities[0].minutes,95);assert.equal(r.role,'reader');assert.equal(r.identity,grant[0]);
 assert.equal(r.data.settings.recipient,'');assert.equal(sheets.AccessLog.rows.at(-1)[3],'authorized');
 assert.ok(!JSON.stringify(r).includes(token));assert.ok(!JSON.stringify(r).includes(digest(token)));
}
assert.equal(context.guestRequest({operation:'export.xlsx',token}).ok,true);
assert.equal(sheets.Settings.rows[2][1],'owner-private@example.invalid');

// GET serves a data-free shell. JSONP is closed even for a valid bearer token.
context.ContentService={MimeType:{JSON:'application/json',JAVASCRIPT:'application/javascript'},createTextOutput:text=>({text,setMimeType(mime){this.mime=mime;return this}})};
context.HtmlService={createHtmlOutputFromFile:file=>({file,setTitle(title){this.title=title;return this},addMetaTag(){return this}})};
const beforeGet=sheetCalls;
assert.equal(context.doGet().file,'View');
assert.equal(context.doGet({parameter:{date:'2026-10-11',token}}).file,'View');
for(const callback of ['', 'MR_read_isolated_123', 'alert', 'MR_read_a.b', 'MR_read_x);throw Error(1)//']){
 const out=context.doGet({parameter:{callback,operation:'read',token}});
 assert.equal(out.mime,'application/json');const r=JSON.parse(out.text);assert.equal(r.code,'FORBIDDEN');assert.equal(r.data,undefined);
 assert.ok(!out.text.includes(token));assert.ok(!out.text.includes('First isolated week'));
}
const duplicate=context.doGet({parameters:{callback:['MR_read_a','MR_read_b']}});
assert.equal(JSON.parse(duplicate.text).code,'FORBIDDEN');assert.equal(sheetCalls,beforeGet);

// No mutation bridge, and missing/corrupt authorization storage fails closed.
for(const operation of ['commit','create','delete','settings','access','journal'])deniedWithoutRecords(()=>call(operation));
deniedWithoutRecords(()=>context.guestRequest({token,action:'commit',mutations:[{type:'delete',id:'synthetic-0001'}]}));
for(const name of ['AccessGrants','AccessLog']){
 const saved=sheets[name];delete sheets[name];deniedWithoutRecords(()=>call());sheets[name]=saved;
}
const headings=sheets.AccessGrants.rows[0];sheets.AccessGrants.rows[0]=['Unexpected'];deniedWithoutRecords(()=>call());sheets.AccessGrants.rows[0]=headings;
publicSharing=true;deniedWithoutRecords(()=>call());publicSharing=false;
logFails=true;const auditFailure=call();assert.equal(auditFailure.ok,false);assert.equal(auditFailure.data,undefined);logFails=false;

// Revocation/expiry during the data read cannot release the already-read snapshot.
for(const hook of [()=>{grant[3]=new Date().toISOString()},()=>{grant[2]=new Date(Date.now()-1000).toISOString()}]){
 afterLoad=hook;const before=reads,r=call();assert.equal(reads,before+1);assert.equal(r.code,'FORBIDDEN');assert.equal(r.data,undefined);
 grant[3]='';grant[2]=future;
}
// A second fresh check covers revocation during the audit append.
afterAudit=()=>{grant[3]=new Date().toISOString()};const raced=call();assert.equal(raced.code,'FORBIDDEN');assert.equal(raced.data,undefined);grant[3]='';

// The existing authenticated owner API creates/revokes the same token contract.
const admin={...context};vm.createContext(admin);vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'),admin);
identity='reader@example.invalid';assert.equal(admin.journal({action:'access',operation:'list'}).ok,false);identity='owner@example.invalid';
const listed=admin.journal({action:'access',operation:'list'});assert.equal(listed.ok,true);assert.ok(!JSON.stringify(listed).includes(digest(token)));
const newGrant={action:'access',operation:'create',id:'admin-created-access',digest:digest(otherToken),expiresAt:future};
assert.equal(admin.journal(newGrant).ok,true);assert.equal(admin.journal(newGrant).ok,true);
assert.equal(sheets.AccessGrants.rows.filter(row=>row[0]===newGrant.id).length,1);assert.equal(call('read',otherToken).ok,true);
assert.equal(admin.journal({action:'access',operation:'revoke',id:newGrant.id}).ok,true);
assert.equal(deniedWithoutRecords(()=>call('read',otherToken)).code,'FORBIDDEN');
assert.equal(admin.journal({action:'access',operation:'revoke',id:grant[0]}).ok,true);
assert.equal(deniedWithoutRecords(()=>call()).code,'FORBIDDEN');
assert.ok(sheets.AccessLog.rows.every(row=>row.length===4));
assert.ok(sheets.AccessLog.rows.slice(1).every(row=>['unknown','synthetic-access','admin-created-access'].includes(row[1])));
const logs=JSON.stringify(sheets.AccessLog);assert.ok(!logs.includes(token)&&!logs.includes(otherToken)&&!logs.includes(digest(token)));
assert.deepEqual(Object.keys(context).filter(k=>typeof context[k]==='function'&&!k.endsWith('_')).sort(),['doGet','guestRequest']);
console.log('PASS private reader: token hash compatibility, no reads for malformed credentials, invalid/expired/revoked denial before journal reads, full history, closed JSONP, read-only RPC, fresh revocation checks after data/audit, no token logs, owner grant creation/revocation');
