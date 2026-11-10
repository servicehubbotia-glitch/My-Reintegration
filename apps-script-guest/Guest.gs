/** Guest-only project. Never copy journal(), authorize_(), or admin CRUD here.
 * Only doGet and guestRequest are remotely callable. No doPost or mutation bridge.
 * Real records are available only through token-authorized HTMLService RPC.
 * Private script properties: SPREADSHEET_ID and OWNER_EMAIL.
 */
function doGet(e){
 const parameters=e?.parameter||{};
 // JSONP never releases private data, including when a valid token is supplied.
 if(Object.prototype.hasOwnProperty.call(parameters,'callback')||Object.prototype.hasOwnProperty.call(e?.parameters||{},'callback'))
  return guestOutput_(guestDenied_());
 // The shell contains no journal data. Its fragment is read by the client and
 // passed to guestRequest through google.script.run, never a query parameter.
 return HtmlService.createHtmlOutputFromFile('View').setTitle('My Reintegration — Private view').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function guestOutput_(value){
 const json=JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
function guestDenied_(){return {ok:false,code:'FORBIDDEN',message:'This private link is invalid, expired or revoked.'}}
function guestRequest(request){
 const operations=['read','report','export.pdf','export.xlsx','export.csv','export.copy'];
 const operation=operations.includes(request?.operation)?request.operation:'unsupported';
 const token=typeof request?.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(request.token)?request.token:'';
 // Reject missing/malformed credentials and unsupported operations without
 // reading Sheets. A week is display metadata, never an access restriction.
 if(!token||operation==='unsupported')return guestDenied_();
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return {ok:false,code:'BUSY',message:'Please try again.'};
 try{
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id)fail_('SETUP_REQUIRED','The journal is unavailable.');
  const auditId=guestAuditSheet_(id);
  // Match the existing owner registry: SHA-256 of JSON.stringify(token).
  const digest=hash_(token),grant=guestGrant_(id,digest);
  if(!grant){accessLog_(id,auditId,'unknown',operation,false);fail_('FORBIDDEN','Access denied.')}
  let data;
  try{
   privateSheet_(id);
   const loaded=load_(id);
   // The owner API uses another script lock. Re-read the grant after loading
   // records and after auditing; never cache an authorization decision.
   if(guestGrant_(id,digest)?.[0]!==grant[0])fail_('FORBIDDEN','Access denied.');
   data=snapshot_(loaded,{role:'reader',email:grant[0]});data.data.settings.recipient='';
   accessLog_(id,auditId,grant[0],operation,true);
   if(guestGrant_(id,digest)?.[0]!==grant[0])fail_('FORBIDDEN','Access denied.');
  }catch(e){accessLog_(id,auditId,grant[0],operation,false);throw e}
  return {ok:true,...data};
 }catch(e){return e.journalCode==='FORBIDDEN'?guestDenied_():{ok:false,code:e.journalCode||'SERVICE_ERROR',message:'Private access is temporarily unavailable. Please try Refresh.'}}
 finally{lock.releaseLock()}
}
function guestGrant_(id,digest){
 const rows=Sheets.Spreadsheets.Values.get(id,"'AccessGrants'!A:E",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];
 if(JSON.stringify(rows[0])!==JSON.stringify(ACCESS_HEADERS_))fail_('SCHEMA','Private access is unavailable.');
 const grants=rows.slice(1),matches=grants.filter(row=>typeof row[1]==='string'&&/^[a-f0-9]{64}$/.test(row[1])&&equalHash_(row[1],digest));
 if(matches.length!==1)return null;
 const grant=matches[0],expiry=typeof grant[2]==='string'?Date.parse(grant[2]):NaN;
 if(!validId_(grant[0])||grants.filter(row=>row[0]===grant[0]).length!==1
  ||grant[3]!==''&&grant[3]!==undefined&&grant[3]!==null
  ||!Number.isFinite(expiry)||expiry<=Date.now()||new Date(expiry).toISOString()!==grant[2])return null;
 return grant;
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
