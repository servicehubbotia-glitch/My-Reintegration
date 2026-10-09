# Private token view — deployment boundary

This is a separate **read-only Apps Script backend**, using the original spreadsheet and the same generated interface/exporters. Do not deploy the owner project as a public web app: its effective-user check is designed for the owner-only Execution API.

The guest project contains only `Guest.gs`, `ReadHelpers.gs`, `View.html`, and `appsscript.json`. `node scripts/build-guest.cjs` regenerates the latter interface and read helpers from the application. The only remotely callable functions are `doGet` (empty public login interface) and `guestRequest` (authenticated read/export). All other functions have private underscore names. Do not copy owner `journal` or mutation functions into this project.

Configure private Script Properties `SPREADSHEET_ID` and `OWNER_EMAIL`. The same original Sheet must remain Restricted. Enable Sheets v4 and Drive v3. Deploy as an HTMLService web application, execute as the owner, accessible without Google login. This publishes the login shell, **not spreadsheet permissions or records**. Requires explicit deployment approval. Do not use JSONP, URL tokens, CORS workarounds or iframe postMessage bridges.

The owner API remains MYSELF-only. Deploy its updated Code.gs before enabling the new Settings control. That control creates `AccessGrants` and `AccessLog` in the original private spreadsheet on first use. Only hashes, access identifiers, timestamps and fixed operation/result enums are stored. No credentials belong in the repository or logs.

## Owner procedure after deployment

1. In the existing app, connect the owner Google account. Settings & backup → Manage private read-only access.
2. Choose expiry (1–365 days, default 30), then Generate access token. Browser Web Crypto generates 256 random bits. Only its SHA-256 digest is submitted to the owner service. Copy the one-time display and communicate it privately to the intended reader; never append it to the link.
3. Give the reader the guest view URL. The reader enters the token; it lives only in a JavaScript closure. Reload, close or sign out clears it. A bearer token identifies the authorized grant, not a independently verified human identity.
4. Revoke using the corresponding access ID. Each new read/export rereads the registry, so revoked/expired grants cannot fetch new data. There is no authorization cache. The UI also refreshes every 15 seconds and clears its displayed records on rejection. Already delivered records/downloads cannot be recalled.
5. Renew by revoking the old grant and generating a new token with a new expiry. Expired or lost tokens are not recoverable. Review AccessLog in the private original Sheet.

All operations allowlisted (`read`, `report`, `export.pdf`, `export.xlsx`, `export.csv`, `export.copy`) must provide the token. Unknown operations are rejected and logged without their raw input. A failed audit write fails closed. Exports request a fresh authorized snapshot before local file generation. Anonymous requests to the login shell contain no personal data. Tokens are not passed in URLs, localStorage/sessionStorage, console/exception logging or exported reports.

## Verification status

Local security tests use isolated service doubles; Chromium tests use an isolated HTMLService transport. Neither substitutes for a live deployment test. Before announcing completion, verify actual anonymous valid/invalid/expired/revoked access, XLSX/PDF, audit rows, and absence of write RPCs. No real-record test fixtures should be added to Activities/Applications. The production reader deployment is not yet activated.
