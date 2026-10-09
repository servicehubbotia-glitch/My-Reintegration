# Shared read-only view

The owner explicitly approved access for **anyone with the link** on 9 October 2026. This replaces the token login used in versions 1–3. Readers open the link directly: no account, email, access code, expiry or remembered credential is required. The link may be forwarded like an exported workbook.

## Deployment boundary

Keep this project separate from the owner API executable. Its only remotely callable functions are `doGet` and `guestRequest`; helper names end in underscore. The guest service accepts only `read`, `report`, `export.pdf`, `export.xlsx`, `export.csv` and `export.copy`. It has no journal mutation entrypoint. Owner editing remains Google-authenticated and MYSELF-only.

The original spreadsheet stays Restricted. Its ID and owner email remain in private Script Properties (`SPREADSHEET_ID`, `OWNER_EMAIL`). The guest web app executes as the owner and exposes the journal's read-only snapshots through its URL; it does not grant Drive or spreadsheet permissions. The private report-recipient setting is omitted from shared snapshots. Records themselves, including application fields and report display name, are visible to anyone with the URL.

Enable Sheets v4 and Drive v3 and retain the existing manifest scopes. Deploy as an Apps Script web application, execute as the owner, accessible to anyone without Google sign-in. The public URL belongs in `google-config.js` as `guestUrl`. Settings & backup → Share read-only link lets the owner copy or open it.

The deployed project contains `Guest.gs`, `ReadHelpers.gs`, `View.html` and `appsscript.json`. Run `node scripts/build-guest.cjs` to regenerate the interface and read helpers. The build hex-escapes URL slashes in inline scripts for HTMLService compatibility; this preserves Excel workbook values.

## Data and audit

Every view refresh or export fetches the latest snapshot from the original spreadsheet. `AccessLog` records a fixed `link-reader` identifier, operation and result; it does not identify the human reader. Unknown operations are rejected and logged without their raw input. An audit failure prevents release of the response.

The guest service no longer reads `AccessGrants`. Existing revoked test grants and previous logs remain as historical records. The owner API's legacy token functions remain owner-only but are no longer shown in the interface. They do not restrict the shared link. To withdraw this direct view, archive its Apps Script deployment; changing the sheet's owner editing access is a separate operation.

No credentials or journal data are persisted by the guest transport. It removes the old remembered-access key during startup. Google may apply ordinary service limits to the public web app. No synthetic records are added to the real journal for tests.

## Verification

`node tests/guest-backend.cjs` checks credential-free reading/export, rejected mutation attempts, absence of CRUD entrypoints, original-sheet privacy, omission of the private report recipient, generic audit rows and independence from token grants. Owner token-management authorization is separately checked as a legacy function.

`node tests/guest-store.cjs` checks automatic transport without credentials, cleanup of old remembered credentials, no mutation API, failure recovery and stale responses. `node tests/excel.cjs` verifies identical XLSX bytes from the original and generated inline exporter. These isolated tests do not substitute for live deployment checks.

Live version 4 was deployed on 9 October 2026. Opening the existing URL loaded the journal automatically without entering a token or choosing a reader account. The report, PDF and XLSX all succeeded; the downloaded PDF was opened and visually checked, and the XLSX parsed as a real workbook with the expected Blad1 sheet. The actual week was empty. AccessLog independently confirmed the direct read, report and both exports as `link-reader`. Drive metadata still showed only the spreadsheet owner's permission. A separate signed-out browser session and a live write-RPC penetration test were not performed; the deployed reader code has no Google-identity check, and write rejection is covered by isolated service tests.
