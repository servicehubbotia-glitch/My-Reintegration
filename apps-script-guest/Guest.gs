/** Guest-only project. Never copy journal(), authorize_(), or admin CRUD here.
 * Only doGet and guestRequest are remotely callable. No doPost or mutation bridge.
 * The public GitHub reader receives one selected week only, with personal contact fields redacted.
 * Private script properties: SPREADSHEET_ID and OWNER_EMAIL.
 */
function doGet(e){
 const parameters=e?.parameter||{};
 // Old direct links retain the original Apps Script interface.
 if(!Object.prototype.hasOwnProperty.call(parameters,'callback'))
  return HtmlService.createHtmlOutputFromFile('View').setTitle('My Reintegration — Read-only view').addMetaTag('viewport','width=device-width, initial-scale=1');
 const callback=parameters.callback;
 // Only generated, single-segment identifiers are valid. Never evaluate user-supplied expressions.
 if(typeof callback!=='string'||!/^MR_read_[a-z0-9_]{1,80}$/.test(callback)
  ||['callback','operation','week'].some(key=>e?.parameters?.[key]&&e.parameters[key].length!==1))
  return guestOutput_({ok:false,code:'INVALID_REQUEST',message:'Invalid public reader request.'});
 const request={operation:parameters.operation||'read',week:parameters.week};
 return guestOutput_(guestRequest(request),callback);
}
function guestOutput_(value,callback){
 // Escaping also keeps payloads safe if a response is ever embedded in HTML.
 const json=JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 // A late response after cancellation sees a missing callback and does nothing.
 const body=callback?'typeof '+callback+' === "function" && '+callback+'('+json+');':json;
 return ContentService.createTextOutput(body).setMimeType(callback?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON);
}
function guestRequest(request){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return {ok:false,code:'BUSY',message:'Please try again.'};
 try{
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id)fail_('SETUP_REQUIRED','The journal is unavailable.');
  const auditId=guestAuditSheet_(id);
  const operations=['read','report','export.pdf','export.xlsx','export.csv','export.copy'];
  const operation=operations.includes(request?.operation)?request.operation:'unsupported';
  // The owner explicitly enabled read-only access for anyone with this URL.
  // There is no login or credential. Mutation operations remain unavailable.
  const hasWeek=request?.week!==undefined&&request.week!==null&&request.week!=='';
  const allowed=operation!=='unsupported'
   &&(!hasWeek||validDate_(request.week))
   &&(operation==='read'||hasWeek);
  if(!allowed){accessLog_(id,auditId,'link-reader',operation,false);fail_('FORBIDDEN','This view only supports reading and downloading reports.')}
  let data;
  try{
   privateSheet_(id);
   data=publicWeekSnapshot_(snapshot_(load_(id),{role:'reader',email:'link-reader'}),hasWeek?request.week:null);
  }
  catch(e){accessLog_(id,auditId,'link-reader',operation,false);throw e}
  // Log only a generic reader identity and fixed operation/result values.
  accessLog_(id,auditId,'link-reader',operation,true);
  return {ok:true,...data};
 }catch(e){return {ok:false,code:e.journalCode||'SERVICE_ERROR',message:e.journalCode==='FORBIDDEN'?'This view only supports reading and downloading reports.':'The journal is temporarily unavailable. Please try Refresh.'}}
 finally{lock.releaseLock()}
}
// The public endpoint must never return the entire journal or personal contact details.
function publicWeekSnapshot_(snapshot,requestedDate){
 const data=snapshot.data;
 const available=[...data.activities,...data.applications].map(row=>row.date).filter(validDate_).sort();
 const focus=requestedDate||available[available.length-1]||new Date().toISOString().slice(0,10);
 const start=new Date(focus+'T00:00:00.000Z');
 start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
 const from=start.toISOString().slice(0,10);
 start.setUTCDate(start.getUTCDate()+6);
 const to=start.toISOString().slice(0,10);
 data.settings.recipient='';
 data.activities=data.activities.filter(row=>row.date>=from&&row.date<=to);
 data.applications=data.applications.filter(row=>row.date>=from&&row.date<=to)
  .map(row=>({...row,conversation:'',withWhom:'',phone:''}));
 return snapshot;
}

function guestAuditSheet_(id){
 const sheet=Sheets.Spreadsheets.get(id,{fields:'sheets(properties(sheetId,title))'}).sheets.find(s=>s.properties.title==='AccessLog');
 if(!sheet)fail_('SETUP_REQUIRED','The journal is unavailable.');
 const headers=Sheets.Spreadsheets.Values.get(id,"'AccessLog'!A1:D1",{valueRenderOption:'UNFORMATTED_VALUE'}).values?.[0];
 if(JSON.stringify(headers)!==JSON.stringify(LOG_HEADERS_))fail_('SCHEMA','The journal is unavailable.');
 return sheet.properties.sheetId;
}
function privateSheet_(id){
 const owner=(PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL')||'').toLowerCase();
 const file=Drive.Files.get(id,{fields:'mimeType,owners(emailAddress)'});
 if(!owner||file.mimeType!=='application/vnd.google-apps.spreadsheet'||!file.owners?.some(o=>o.emailAddress.toLowerCase()===owner))fail_('FORBIDDEN','Access denied.');
 let pageToken;do{const p=Drive.Permissions.list(id,{fields:'permissions(type),nextPageToken',pageToken:pageToken||undefined});if(p.permissions.some(x=>x.type==='anyone'||x.type==='domain'))fail_('FORBIDDEN','Access denied.');pageToken=p.nextPageToken}while(pageToken);
}
