# Private token view — deployment boundary

This is a separate **read-only Apps Script backend**, using the original spreadsheet and the same generated interface/exporters. Do not deploy the owner project as a public web app: its effective-user check is designed for the owner-only Execution API.

The guest project contains only `Guest.gs`, `ReadHelpers.gs`, `View.html`, and `appsscript.json`. `node scripts/build-guest.cjs` regenerates the latter interface and read helpers from the application. The only remotely callable functions are `doGet` (empty public login interface) and `guestRequest` (authenticated read/export). All other functions have private underscore names. Do not copy owner `journal` or mutation functions into this project.

Configure private Script Properties `SPREADSHEET_ID` and `OWNER_EMAIL`. The same original Sheet must remain Restricted. Enable Sheets v4 and Drive v3. Deploy as an HTMLService web application, execute as the owner, accessible without Google login. This publishes the login shell, **not spreadsheet permissions or records**. Requires explicit deployment approval. Do not use JSONP, URL tokens, CORS workarounds or iframe postMessage bridges.

The owner API remains MYSELF-only. Deploy its updated Code.gs before enabling the new Settings control. That control creates `AccessGrants` and `AccessLog` in the original private spreadsheet on first use. Only hashes, access identifiers, timestamps and fixed operation/result enums are stored. No credentials belong in the repository or logs.

## Owner procedure after deployment

1. In the existing app, connect the owner Google account. Settings & backup → Manage private read-only access.
2. Choose expiry (1–365 days, default 30), then Generate access token. Browser Web Crypto generates 256 random bits. Only its SHA-256 digest is submitted to the owner service. Copy the one-time display and communicate it privately to the intended reader; never append it to the link.
3. Give the reader the guest view URL. The reader enters the token once and may select **Remember access on this device** on their own device. After successful server authorization, this opt-in saves only the credential in that browser's localStorage; later visits reauthorize automatically. Leaving it unchecked keeps access in memory for that visit. Signing out forgets remembered access. A bearer token identifies the authorized grant, not an independently verified human identity.
4. Revoke using the corresponding access ID. Each new read/export rereads the registry, so revoked/expired grants cannot fetch new data. There is no authorization cache. The UI also refreshes every 15 seconds and clears its displayed records on rejection. Already delivered records/downloads cannot be recalled.
5. Renew by revoking the old grant and generating a new token with a new expiry. Expired or lost tokens are not recoverable. Review AccessLog in the private original Sheet.

All operations allowlisted (`read`, `report`, `export.pdf`, `export.xlsx`, `export.csv`, `export.copy`) must provide the token. Unknown operations are rejected and logged without their raw input. A failed audit write fails closed. Exports request a fresh authorized snapshot before local file generation. Anonymous requests to the login shell contain no personal data. Tokens are never placed in URLs, sessionStorage, console/exception logging or exported reports. Remembered access uses the dedicated localStorage key `my-reintegration-guest-access-v1`; it does not cache journal data or bypass authorization. Invalid, expired or revoked grants clear the stored credential. Transient connection failures clear displayed access but keep an opted-in credential for a later retry. Browsers that block storage fall back to session-only access and display a notice.

## Verification status — 9 October 2026

The guest web app is active at version 3, with Sheets v4, Drive v3, private Script Properties and owner execution. The separate owner API executable remains version 2 and MYSELF-only; live token creation/list/revocation work from the owner app. The original spreadsheet is still Restricted, with only its owner permission.

Version 3 adds opt-in remembered access. Live verification confirmed automatic authorized access after reload and in a new tab, sign-out forgetting access across open tabs, and revoked access denied and logged. Both temporary verification grants were left revoked. `node tests/guest-store.cjs` checks the source and generated transport with isolated fixtures: opt-in persistence only after authorization, fresh authorization on return, sign-out, expiration/revocation rejection, transient failures, stale callbacks and storage being unavailable. Remembered access preserves the existing grant's permissions and expiry.

Live checks passed: valid token access, rejection of an unknown token, rejection after moving the temporary test grant's expiry into the past, and rejection after revocation through the owner app. Expiry was restored before testing revocation; the test grant was left revoked. No journal records were created or changed. Each outcome and both exports were independently checked in AccessLog. The UI cleared access after rejection. A cookie-free HTTP request returned the public login shell with HTTP 200, without requiring Google login or returning the owner's name. Token-based UI tests used the connected browser; a separate signed-out browser was not used.

PDF and XLSX were downloaded from the deployed service and independently opened. PDF was visually checked; XLSX parsed successfully as a real OOXML workbook with the expected Blad1 sheet. The current week contained no activities or applications, so live export checks cover that empty-week case. Populated export fixtures remain isolated tests.

The live check found HTMLService truncating an XML namespace string at `http://` in the inline Excel exporter. The build now hex-escapes URL slashes without changing their JavaScript string values. The served version compiles, the real XLSX download succeeds, and `node tests/excel.cjs` verifies the generated inline exporter produces identical workbook bytes to the original module.

`node tests/guest-backend.cjs` also passes authorization, operation allowlisting, private sharing, audit failure, token secrecy and absence of CRUD entrypoint checks with isolated service doubles. These code-level checks do not claim a live write-RPC penetration test. Keep credentials, raw tokens, spreadsheet IDs and audit contents out of this repository.
