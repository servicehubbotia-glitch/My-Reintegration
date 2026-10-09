// Owner sharing control. The shared URL opens a separate read-only service.
'use strict';
(()=>{
 const dialog=$('#accessManager'),error=$('#accessError'),url=window.MR_GOOGLE_CONFIG?.guestUrl||'';
 $('#sharedViewUrl').value=url;$('#openSharedView').href=url;
 cloud.onStatus(()=>{$('#privateAccess').hidden=cloud.role!=='owner';if(cloud.role!=='owner')dialog.close()});
 $('#privateAccess').onclick=()=>{error.textContent='';dialog.showModal()};
 $('#copyViewLink').onclick=async()=>{try{await navigator.clipboard.writeText(url);error.textContent='Link copied.'}catch{$('#sharedViewUrl').select();error.textContent='The link is selected. Copy it from this field.'}};
})();
