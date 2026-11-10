// Isolated service doubles only. No requests or synthetic records reach Google.
// Direct Sheet edits below occur before journal() reads; these tests do not
// claim to eliminate races with a writer outside the Apps Script lock.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=fs.readFileSync('apps-script/Code.gs','utf8');
const owner='owner@example.invalid',editor='editor@example.invalid',reader='reader@example.invalid';
const body=record=>Object.fromEntries(Object.entries(record).filter(([key])=>!['createdAt','updatedAt','_row'].includes(key)));
const activity=(id='test-activity-0001',extra={})=>({id,date:'2026-11-02',activity:'Synthetic training',category:'Training',outcome:'Initial outcome',completed:'No',minutes:95,mail:'No',...extra});
const application=(id='test-application-0001',extra={})=>({id,date:'2026-11-03',function:'Synthetic role',company:'Synthetic company',via:'Direct',conversation:'',interview:'',withWhom:'',phone:'',result:'Pending',...extra});

function fixture(){
 let identity=owner,canEdit=true,publicSharing='',sequence=0;
 let data=[[],[],[['Key','Value','Updated at'],['Weekly goal',20],['Report recipient',''],['User display name',''],['Schema version',2]],[['Access ID','Token hash','Expires at','Revoked at','Created at']],[['Timestamp','Access ID','Operation','Result']]];
 const ids=[201,202,203,204,205],names=['Activities','Applications','Settings','AccessGrants','AccessLog'],batches=[];
 const properties={SPREADSHEET_ID:'isolated-test',OWNER_EMAIL:owner,EDITOR_EMAILS:'[" Editor@Example.Invalid "]',READER_EMAILS:JSON.stringify([reader])};
 const context={
  Session:{getEffectiveUser:()=>({getEmail:()=>identity})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]})},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  Utilities:{DigestAlgorithm:{SHA_256:1},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()]},
  Drive:{Files:{get:()=>({mimeType:'application/vnd.google-apps.spreadsheet',owners:[{emailAddress:owner}],capabilities:{canEdit}})},Permissions:{list:()=>({permissions:publicSharing?[{type:publicSharing,role:'reader'}]:[{type:'user',role:'owner'}]})}},
  Sheets:{Spreadsheets:{get:()=>({sheets:names.map((title,i)=>({properties:{title,sheetId:ids[i]}}))}),Values:{batchGet:()=>({valueRanges:data.slice(0,3).map(values=>({values:structuredClone(values)}))}),get:(_,range)=>({values:structuredClone(data[names.findIndex(name=>range.startsWith("'"+name+"'!"))])})}}}
 };
 context.Sheets.Spreadsheets.batchUpdate=({requests})=>{
  const next=structuredClone(data),values=row=>Array.from(row.values,c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue);
  for(const r of requests){
   if(r.appendCells){const a=r.appendCells;next[ids.indexOf(a.sheetId)].push(...a.rows.map(values))}
   else if(r.updateCells){const a=r.updateCells;a.rows.forEach((row,i)=>{next[ids.indexOf(a.start.sheetId)][a.start.rowIndex+i]=values(row)})}
   else if(r.deleteDimension){const a=r.deleteDimension.range;next[ids.indexOf(a.sheetId)].splice(a.startIndex,a.endIndex-a.startIndex)}
   else throw Error('Unexpected write request in isolated backend test');
  }
  data=next;batches.push(structuredClone(requests));return {};
 };
 vm.createContext(context);vm.runInContext(source,context);
 data[0]=[structuredClone(vm.runInContext('TABLES_.activities.headers',context))];
 data[1]=[structuredClone(vm.runInContext('TABLES_.applications.headers',context))];
 const call=request=>structuredClone(context.journal(request));
 const read=()=>call({action:'read'});
 const request=(mutations,base=read())=>({action:'commit',revision:base.revision,requestId:'isolated-request-'+(++sequence),mutations});
 return {call,read,request,properties,batches,
  commit:(mutations,base)=>call(request(mutations,base)),
  row:(kind,id)=>data[kind==='activities'?0:1].find(row=>row[0]===id),
  get data(){return data},set identity(value){identity=value},set canEdit(value){canEdit=value},set publicSharing(value){publicSharing=value}};
}
const put=(kind,record,before=null)=>({type:'put',kind,record:body(record),before:before===null?null:body(before)});
const remove=(kind,record)=>({type:'delete',kind,id:record.id,before:body(record)});
function seed(f,activities=[activity()],applications=[]){
 const r=f.commit([...activities.map(a=>put('activities',a)),...applications.map(a=>put('applications',a))]);
 assert.equal(r.ok,true,r.message);return r;
}
function rejected(f,request,code){
 const saved=structuredClone(f.data),count=f.batches.length,result=f.call(request);
 assert.equal(result.ok,false);assert.equal(result.code,code,result.message);
 assert.equal(f.batches.length,count,'Rejected request must not write data or an operation receipt');
 assert.deepEqual(f.data,saved,'Rejected batch must preserve every row');return result;
}
function test(label,run){run();console.log('PASS '+label)}

test('owner and normalized editor allowlist both support activity/application CRUD',()=>{
 for(const [identity,role] of [[owner,'owner'],[editor,'editor']]){
  const f=fixture();f.identity=identity;assert.equal(f.read().role,role);
  let r=seed(f,[activity(undefined,{activity:'=IMPORTXML("x")'})],[application()]);
  assert.equal(r.role,role);assert.equal(r.identity,identity);
  assert.equal(f.row('activities','test-activity-0001')[2],'=IMPORTXML("x")');
  assert.equal(f.batches[0][0].appendCells.rows[0].values[2].userEnteredValue.stringValue,'=IMPORTXML("x")');
  assert.equal(typeof f.row('activities','test-activity-0001')[6],'number');
  const a=r.data.activities[0],job=r.data.applications[0];
  r=f.commit([put('activities',{...a,minutes:120},a),put('applications',{...job,result:'Interview planned'},job)],r);
  assert.equal(r.ok,true,r.message);assert.equal(r.data.activities[0].minutes,120);
  assert.equal(r.data.applications[0].result,'Interview planned');
  assert.equal(r.data.activities[0].createdAt,a.createdAt);assert.ok(r.data.activities[0].updatedAt);
  r=f.commit([remove('activities',r.data.activities[0]),remove('applications',r.data.applications[0])],r);
  assert.equal(r.ok,true,r.message);assert.equal(r.data.activities.length,0);assert.equal(r.data.applications.length,0);
 }
});

test('reader/unknown denied writes and access management; editor requires Drive canEdit',()=>{
 const f=fixture(),base=seed(f),request=f.request([put('activities',activity('test-activity-0002'))],base);
 f.identity=reader;assert.equal(f.read().role,'reader');assert.equal(f.read().data.activities.length,1);
 rejected(f,request,'FORBIDDEN');
 for(const identity of ['stranger@example.invalid','']){
  f.identity=identity;assert.equal(f.read().code,'FORBIDDEN');rejected(f,request,'FORBIDDEN');
 }
 f.identity=editor;f.canEdit=false;assert.equal(f.read().code,'FORBIDDEN');rejected(f,request,'FORBIDDEN');
 f.canEdit=true;assert.equal(f.read().role,'editor');
 f.identity=reader;
 for(const operation of ['list','create','revoke'])rejected(f,{action:'access',operation,id:'test-access-0001',digest:'a'.repeat(64),expiresAt:new Date(Date.now()+86400000).toISOString()},'FORBIDDEN');
 f.identity=owner;f.canEdit=false;rejected(f,request,'FORBIDDEN');
});

test('both authorized editor identities can create, list and revoke read-only links',()=>{
 for(const identity of [owner,editor]){
  const f=fixture();f.identity=identity;
  const grant={id:'test-access-0001',digest:'a'.repeat(64),expiresAt:new Date(Date.now()+86400000).toISOString()};
  assert.deepEqual(f.call({action:'access',operation:'list'}).grants,[]);
  const created=f.call({action:'access',operation:'create',...grant});assert.equal(created.ok,true,created.message);
  assert.equal(created.grants.length,1);assert.equal(created.grants[0].id,grant.id);
  assert.equal(JSON.stringify(created).includes(grant.digest),false,'Hash must not be returned to the browser');
  const written=f.batches.length;assert.equal(f.call({action:'access',operation:'create',...grant}).ok,true);assert.equal(f.batches.length,written,'Create retry is idempotent');
  const revoked=f.call({action:'access',operation:'revoke',id:grant.id});assert.equal(revoked.ok,true,revoked.message);assert.ok(revoked.grants[0].revokedAt);
  assert.equal(f.data[0].length,1);assert.equal(f.data[1].length,1,'Access management must not change activity/application rows');
 }
});

test('public sharing and malformed editor configuration fail closed',()=>{
 const f=fixture();
 for(const sharing of ['anyone','domain']){f.publicSharing=sharing;assert.equal(f.read().code,'PUBLIC_SHARING')}
 f.publicSharing='';
 for(const config of ['{','{}','[null]','[""]']){f.properties.EDITOR_EMAILS=config;assert.equal(f.read().code,'SETUP_REQUIRED')}
 assert.equal(f.batches.length,0);
});

test('idempotent retry writes once; reused request IDs and stale legacy revisions are rejected',()=>{
 const f=fixture(),initial=f.read(),request=f.request([put('activities',activity())],initial);
 const saved=f.call(request);assert.equal(saved.ok,true,saved.message);
 assert.equal(f.batches.length,1);assert.equal(f.data[2].filter(row=>row[0]==='_op:'+request.requestId).length,1);
 assert.equal(f.call(request).replayed,true);assert.equal(f.batches.length,1);
 rejected(f,{...request,mutations:[put('activities',activity(undefined,{minutes:96}))]},'CONFLICT');
 // Existing pending clients without `before` keep the conservative global guard.
 const legacy=f.request([{type:'put',kind:'activities',record:activity('test-activity-0002')}],initial);
 rejected(f,legacy,'CONFLICT');
 assert.equal(f.call({...legacy,revision:saved.revision}).ok,true);
});

test('stale snapshot can save a disjoint record while preserving direct Sheet edits',()=>{
 const f=fixture(),base=seed(f,[activity(),activity('test-activity-0002')],[application()]);
 const a=base.data.activities[0],b=base.data.activities[1],stamp=f.row('activities',b.id)[9];
 f.row('activities',b.id)[4]='Outcome changed directly in Sheets';
 f.row('applications','test-application-0001')[9]='Application changed directly in Sheets';
 f.data[2].find(row=>row[0]==='Weekly goal')[1]=25;
 assert.equal(f.row('activities',b.id)[9],stamp);assert.notEqual(f.read().revision,base.revision);
 const saved=f.commit([put('activities',{...a,minutes:120},a)],base);
 assert.equal(saved.ok,true,saved.message);assert.equal(saved.data.activities.find(r=>r.id===a.id).minutes,120);
 assert.equal(saved.data.activities.find(r=>r.id===b.id).outcome,'Outcome changed directly in Sheets');
 assert.equal(saved.data.applications[0].result,'Application changed directly in Sheets');assert.equal(saved.data.settings.goal,25);
});

test('same-record edits without timestamp updates reject both stale updates and deletes',()=>{
 const f=fixture(),base=seed(f),a=base.data.activities[0],stamp=f.row('activities',a.id)[9];
 f.row('activities',a.id)[4]='New direct Sheet outcome';assert.equal(f.row('activities',a.id)[9],stamp);
 rejected(f,f.request([put('activities',{...a,minutes:120},a)],base),'CONFLICT');
 rejected(f,f.request([remove('activities',a)],base),'CONFLICT');
 // A concurrent deletion must not be silently recreated or reported as deleted by this save.
 f.data[0].splice(1,1);
 rejected(f,f.request([put('activities',{...a,minutes:120},a)],base),'CONFLICT');
 rejected(f,f.request([remove('activities',a)],base),'CONFLICT');
});

test('before:null cannot overwrite an ID created directly in Sheets after the app read',()=>{
 const f=fixture(),base=f.read(),a=activity();
 f.data[0].push([a.id,a.date,'Directly entered activity',a.category,a.outcome,a.completed,a.minutes,a.mail,'2026-11-02','2026-11-02']);
 rejected(f,f.request([put('activities',a)],base),'CONFLICT');
 assert.equal(f.row('activities',a.id)[2],'Directly entered activity');
});

test('one conflict or invalid mutation rejects the entire batch with no partial write',()=>{
 const f=fixture(),base=seed(f,[activity(),activity('test-activity-0002')]);
 const [a,b]=base.data.activities;f.row('activities',b.id)[4]='Concurrent direct change';
 rejected(f,f.request([put('activities',{...a,minutes:120},a),put('activities',{...b,minutes:130},b)],base),'CONFLICT');
 const fresh=f.read(),current=fresh.data.activities[0];
 rejected(f,f.request([put('activities',{...current,minutes:120},current),put('activities',activity('test-activity-0003',{minutes:-1}))],fresh),'INVALID');
 rejected(f,f.request([put('activities',{...current,minutes:120},current),remove('activities',current)],fresh),'INVALID');
});

test('row reordering is harmless: update and delete still target the stable record IDs',()=>{
 const f=fixture(),base=seed(f,[activity(),activity('test-activity-0002')],[application()]);
 const [a,b]=base.data.activities;f.data[0].splice(1,2,...f.data[0].slice(1).reverse());
 assert.notEqual(f.read().revision,base.revision);
 const saved=f.commit([put('activities',{...a,minutes:120},a),remove('activities',b)],base);
 assert.equal(saved.ok,true,saved.message);assert.equal(saved.data.activities.length,1);
 assert.equal(saved.data.activities[0].id,a.id);assert.equal(saved.data.activities[0].minutes,120);
 assert.equal(saved.data.applications[0].id,'test-application-0001');
});

test('settings have their own before guard and do not overwrite direct changes',()=>{
 const f=fixture(),base=seed(f);f.row('activities','test-activity-0001')[4]='Unrelated direct change';
 // Different object-key order is not a conflict.
 const before={name:base.data.settings.name,recipient:base.data.settings.recipient,goal:base.data.settings.goal};
 const saved=f.commit([{type:'settings',before,settings:{...base.data.settings,goal:25}}],base);
 assert.equal(saved.ok,true,saved.message);assert.equal(saved.data.settings.goal,25);
 assert.equal(saved.data.activities[0].outcome,'Unrelated direct change');
 f.data[2].find(row=>row[0]==='User display name')[1]='Changed in Sheets';
 rejected(f,f.request([{type:'settings',before:saved.data.settings,settings:{...saved.data.settings,goal:30}}],saved),'CONFLICT');
});

console.log('PASS isolated backend suite: permissions, record preconditions, direct Sheet edits, atomic batches, stable IDs and recovery');
