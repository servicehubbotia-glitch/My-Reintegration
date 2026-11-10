// Public demonstration data. This transport never reads storage or contacts a service.
'use strict';
(()=>{
 if(window.MR_MODE!=='demo')return;
 const settings=()=>({goal:20,recipient:'',name:'DEMO — fictional records'});
 const copy=value=>JSON.parse(JSON.stringify(value));
 const fields={
  activities:['id','date','activity','category','outcome','completed','minutes','mail'],
  applications:['id','date','function','company','via','conversation','interview','withWhom','phone','result']
 };
 function examples(){
  const activities=[
   ['2026-11-02','Explore sample roles','Job searching',240],
   ['2026-11-03','Practise a sample language lesson','Dutch language study',120],
   ['2026-11-03','Draft a fictional cover letter','CV and cover letter preparation',120],
   ['2026-11-04','Complete a sample learning module','Online training',240],
   ['2026-11-05','Prepare a simulated interview','Interviews',240],
   ['2026-11-06','Review the sample week','Other reintegration activities',240],
   ['2026-11-09','Plan a fictional job search','Job searching',180],
   ['2026-11-09','Update a fictional CV','CV and cover letter preparation',60],
   ['2026-11-10','Practise sample conversations','Dutch language study',240],
   ['2026-11-11','Research fictional employers','Job searching',240],
   ['2026-11-12','Try a sample skills exercise','Online training',240],
   ['2026-11-13','Review simulated applications','Job applications',240]
  ].map(([date,title,category,minutes],i)=>({
   id:'demo-activity-'+String(i+1).padStart(3,'0'),date,activity:'[DEMO] '+title,category,
   outcome:'Fictional example for exploring the journal. No real activity or person is represented.',
   completed:i===10?'No':'Yes',minutes,mail:'No',
   createdAt:date+'T12:00:00.000Z',updatedAt:date+'T12:00:00.000Z'
  }));
  const applications=[
   ['2026-11-02','Office assistant','Example Meadow Studio','Awaiting a simulated reply',''],
   ['2026-11-05','Customer support assistant','Example Lantern Workshop','Simulated interview arranged','2026-11-06'],
   ['2026-11-09','Planning assistant','Example Cedar Office','Sample application under review',''],
   ['2026-11-12','Training coordinator','Example Paper Garden','Fictional practice application completed','']
  ].map(([date,job,company,result,interview],i)=>({
   id:'demo-application-'+String(i+1).padStart(3,'0'),date,function:'[DEMO] '+job,
   company:company+' (fictional)',via:'Fictional vacancy board',
   conversation:'Simulated conversation for this demonstration only.',interview,
   withWhom:'Fictional demo recruiter',phone:'',result:'[DEMO] '+result,
   createdAt:date+'T12:00:00.000Z',updatedAt:date+'T12:00:00.000Z'
  }));
  return {version:1,settings:settings(),activities,applications};
 }
 let current=examples(),connected=true,status='Demo — changes stay in this tab';
 const listeners=new Set();
 const event=()=>({status,message:'',role:connected?'editor':'',identity:connected?'demo':'',pending:false,loading:false});
 function signal(next){status=next;listeners.forEach(listener=>listener(event()))}
 function failure(message){const error=Error(message);error.code='DEMO_ONLY';return error}
 function active(){if(!connected)throw failure('The demo is paused. Reset the demo to continue.')}
 function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}
 function checked(next){
  if(!next||next.version!==1||!next.settings||!Array.isArray(next.activities)||!Array.isArray(next.applications))throw failure('Invalid demo records.');
  const result={version:1,settings:settings(),activities:[],applications:[]},now=new Date().toISOString();
  for(const kind of Object.keys(fields)){
   const ids=new Set();
   for(const row of next[kind]){
    if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||!validDate(row.date))throw failure('Invalid or duplicate demo record.');
    ids.add(row.id);
    if(fields[kind].some(key=>key!=='minutes'&&(typeof row[key]!=='string'||row[key].length>50000)))throw failure('Invalid demo record field.');
    if(kind==='activities'&&(!row.activity.trim()||!Number.isSafeInteger(row.minutes)||row.minutes<0||row.minutes>10080||!['Yes','No'].includes(row.completed)||!['Yes','No'].includes(row.mail)))throw failure('Invalid demo activity.');
    if(kind==='applications'&&(!row.function.trim()||!row.company.trim()||(row.interview&&!validDate(row.interview))))throw failure('Invalid demo application.');
    const prior=current[kind].find(record=>record.id===row.id);
    result[kind].push({...Object.fromEntries(fields[kind].map(key=>[key,row[key]])),createdAt:prior?.createdAt||now,updatedAt:now});
   }
  }
  return result;
 }
 async function connect(){connected=true;signal('Demo — changes stay in this tab');return copy(current)}
 async function refresh(){active();return copy(current)}
 async function commit(next){active();const accepted=checked(next);current=accepted;signal('Demo — saved only in this tab');return copy(current)}
 async function reset(){current=examples();connected=true;signal('Demo — sample records restored');return copy(current)}
 function disconnect(){current=examples();connected=false;signal('Demo paused')}
 const unavailable=async()=>{throw failure('Private sharing and Google access are unavailable in the demo.')};
 window.JournalCloud={
  demo:true,guest:false,publicLink:false,connect,refresh,commit,reset,disconnect,
  manageAccess:unavailable,retry:refresh,discardPending(){},
  onStatus(listener){listeners.add(listener);listener(event());return()=>listeners.delete(listener)},
  get role(){return connected?'editor':''},get identity(){return connected?'demo':''},
  get hasPending(){return false},get pendingBackup(){return null},get loading(){return false},
  get status(){return status},get lastError(){return ''}
 };
})();
