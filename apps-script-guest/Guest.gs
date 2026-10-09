/** Guest-only project. Never copy journal(), authorize_(), or admin CRUD here.
 * Only doGet and guestRequest are remotely callable. No doPost, JSONP, CORS bridge.
 * Private script properties: SPREADSHEET_ID and OWNER_EMAIL.
 */
function doGet(){return HtmlService.createHtmlOutputFromFile('View').setTitle('My Reintegration — Private view').addMetaTag('viewport','width=device-width, initial-scale=1')}
function guestRequest(request){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return {ok:false,code:'BUSY',message:'Please try again.'};
 try{
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id)fail_('SETUP_REQUIRED','Private access is unavailable.');
  const db=accessSheets_(id,false);
  const operations=['read','report','export.pdf','export.xlsx','export.csv','export.copy'];
  const operation=operations.includes(request?.operation)?request.operation:'unsupported';
  // Missing/malformed credentials still produce a rejection audit, without logging input.
  const token=typeof request?.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(request.token)?request.token:'';
  const digest=hash_(token);
  const matches=db.AccessGrants.rows.filter(row=>equalHash_(String(row[1]||''),digest));
  const grant=matches.length===1?matches[0]:null;
  const allowed=!!token&&!!grant&&!grant[3]&&Date.parse(grant[2])>Date.now()&&operation!=='unsupported'&&(operation==='read'||validDate_(request.week));
  if(!allowed){accessLog_(id,db.AccessLog.sheetId,grant?.[0]||'unknown',operation,false);fail_('FORBIDDEN','Access is invalid, expired or revoked.')}
  let data;
  try{privateSheet_(id);data=snapshot_(load_(id),{role:'reader',email:grant[0]})}
  catch(e){accessLog_(id,db.AccessLog.sheetId,grant[0],operation,false);throw e}
  // A failed audit write prevents release of any data. Never cache an authorization decision.
  accessLog_(id,db.AccessLog.sheetId,grant[0],operation,true);
  return {ok:true,...data};
 }catch(e){return {ok:false,code:e.journalCode||'SERVICE_ERROR',message:e.journalCode==='FORBIDDEN'?'Access is invalid, expired or revoked.':'Private access is temporarily unavailable.'}}
 finally{lock.releaseLock()}
}
function privateSheet_(id){
 const owner=(PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL')||'').toLowerCase();
 const file=Drive.Files.get(id,{fields:'mimeType,owners(emailAddress)'});
 if(!owner||file.mimeType!=='application/vnd.google-apps.spreadsheet'||!file.owners?.some(o=>o.emailAddress.toLowerCase()===owner))fail_('FORBIDDEN','Access denied.');
 let pageToken;do{const p=Drive.Permissions.list(id,{fields:'permissions(type),nextPageToken',pageToken:pageToken||undefined});if(p.permissions.some(x=>x.type==='anyone'||x.type==='domain'))fail_('FORBIDDEN','Access denied.');pageToken=p.nextPageToken}while(pageToken);
}
