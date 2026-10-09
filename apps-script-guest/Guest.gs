/** Guest-only project. Never copy journal(), authorize_(), or admin CRUD here.
 * Only doGet and guestRequest are remotely callable. No doPost, JSONP, CORS bridge.
 * Private script properties: SPREADSHEET_ID and OWNER_EMAIL.
 */
function doGet(){return HtmlService.createHtmlOutputFromFile('View').setTitle('My Reintegration — Read-only view').addMetaTag('viewport','width=device-width, initial-scale=1')}
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
  const allowed=operation!=='unsupported'&&(operation==='read'||validDate_(request.week));
  if(!allowed){accessLog_(id,auditId,'link-reader',operation,false);fail_('FORBIDDEN','This view only supports reading and downloading reports.')}
  let data;
  try{privateSheet_(id);data=snapshot_(load_(id),{role:'reader',email:'link-reader'});data.data.settings.recipient=''}
  catch(e){accessLog_(id,auditId,'link-reader',operation,false);throw e}
  // Log only a generic reader identity and fixed operation/result values.
  accessLog_(id,auditId,'link-reader',operation,true);
  return {ok:true,...data};
 }catch(e){return {ok:false,code:e.journalCode||'SERVICE_ERROR',message:e.journalCode==='FORBIDDEN'?'This view only supports reading and downloading reports.':'The journal is temporarily unavailable. Please try Refresh.'}}
 finally{lock.releaseLock()}
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
