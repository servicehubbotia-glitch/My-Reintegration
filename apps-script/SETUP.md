# Authorized Google deployment

The owner-only API executable has been deployed and the original spreadsheet is Restricted. Live service tests passed for read/create/edit/delete, idempotent retry and literal formula handling in temporary isolated tabs; those tabs were removed. GitHub Pages OAuth/API connection, real settings writes, independent spreadsheet readback and recovery in a second authenticated app tab are verified. Downloaded XLSX files from both sessions were independently parsed. Reader identity access remains disabled; reader authorization tests use isolated fixtures. Original local-record migration is user-initiated in the browser where those records exist. No private workbook, account identity, spreadsheet ID, OAuth secret or token belongs in the public repository.

## Owner and authorized-editor setup

As of 9 October 2026, the API executable includes token grant management. The privacy separation candidate lets both already-authorized editing roles create, list and revoke read-only links. The separate reader requires an active private link; see [reader deployment](../apps-script-guest/SETUP.md). Google-identity reader access described below remains optional and disabled unless explicitly configured.

1. In the existing spreadsheet, change General access to **Restricted**. Keep its ID and folder. The service deliberately refuses a spreadsheet with anyone/domain permissions.
2. Open Extensions → Apps Script from that spreadsheet. Add `Code.gs` and the manifest from this directory. Configure Script Properties: `SPREADSHEET_ID` for the original spreadsheet and `OWNER_EMAIL` for its verified owner. Configure `EDITOR_EMAILS` as a JSON array containing the user's explicitly authorized additional editing identity, with Editor access to this same Sheet. The owner already retains maintenance editing. Leave `READER_EMAILS` absent (no authenticated reader access).
3. Associate the script with a standard Google Cloud project owned by the user. Enable Apps Script API, Sheets API and Drive API. Configure the OAuth consent screen and authorize the owner as a test user where appropriate.
4. In that same Cloud project, create a Web OAuth client with JavaScript origin `https://servicehubbotia-glitch.github.io`. Use only its public client ID in `google-config.js`. Do not put a client secret in the app.
5. Authorize the script's scopes and update the existing **API executable** deployment to a new version. Its execution access must permit signed-in accounts (`ANYONE`), while `authorize_()` rejects every identity outside `OWNER_EMAIL`, `EDITOR_EMAILS` and the optional reader list before loading records. Do not use anonymous access or deploy this writing service as a web app. Preserve the deployment identifier in `google-config.js`. Add the authorized personal account to OAuth test users if the Cloud consent configuration requires it.
6. Verify from GitHub Pages that Google Identity Services popup authentication and `scripts.run` work with both real editing accounts, and that the effective identity is the signed-in account. Do not infer these results from isolated tests. Private token-grant administration remains restricted to the owner; ordinary public link sharing is available to both editors.

Reference: https://developers.google.com/apps-script/api/how-tos/execute and https://developers.google.com/identity/oauth2/web/guides/use-token-model

## Data and migration

`Activities`, `Applications` and `Settings` use the exact headers in `Code.gs`. Preserve the original spreadsheet and any existing tabs. Dates are ISO strings; durations integer minutes. Writes use explicit string values so user text cannot become a formula. Transactions use a script lock, record-level original-value checks, an atomic Sheets batch, and a durable request receipt. Changes to unrelated records do not block saving; changes to the same record cause a conflict without any partial batch write. Old clients without original-value checks retain the strict global revision guard. Direct Sheets writes do not participate in the script lock and there is no atomic compare-and-write guarantee against an external write between the app's read and batch. Preserve record IDs and verify direct writes with readback.

The app does not delete `my-reintegration-v1`. Export its JSON backup before migration. Migration merges by ID/content, preserves cloud rows, assigns deterministic IDs to conflicting records, and verifies the result. Failed saves retain an account-specific recovery envelope; tokens remain only in memory. Recovery files and browser drafts contain private information.

## Reader access — disabled until explicitly approved

After the owner explicitly authorizes a specific, verified Google identity, give that identity **Viewer** permission on the original sheet, add the exact email to `READER_EMAILS`, and configure an authenticated API-executable deployment compatible with that account. Verify it live. Do not grant public/link access. The backend rejects commits for every reader. A viewer can export all rows authorized by this dataset; it is not row-level access control.

## Release gate

- Verify both authorized editing identities can create/edit/delete, and recovery after lost confirmation.
- Verify a second authorized session reads the same persisted values.
- Verify reader export and direct API write denial, not just hidden UI controls.
- Verify an unauthorized account cannot read.
- No synthetic records in the real Activities/Applications tabs. Use isolated fixtures for automated tests and agreed real records for live checks.
- Run desktop/mobile regression checks after configuration, including past weeks and all exports.
- Confirm migration against original local backup before treating Sheets as primary.

## Template evidence

The original attachment `activiteiten dag boek, activity log (ENG).xlsx` was read from the supplied Gmail message. It has one tab, `Blad1`, with `Reintegration Activities Log`, `Ongoing Applications` (9 columns), and `Activity` in that order. The exporter follows those sections and headings, places dates and durations in typed Excel cells and expands rows as needed. It does not turn the original example illustration into records. Recipient comes from private app settings.

The attachment's text was readable; binary download returned HTTP 403. Exact original visual formatting, merged cells and embedded images therefore remain unverified. The output is a real OOXML workbook independently parsed with openpyxl; it is not a renamed CSV.

Local checks: `node tests/backend.cjs`, `node tests/excel.cjs`. Backend tests use service doubles and do not prove live OAuth, CORS or Google persistence. `tests/cloud-browser.cjs` validates the integrated UI using isolated simulated Google transport. `tests/browser.cjs` is retained as a historical test of the local-only version.

## Public demonstration separation

The Pages root serves fictional demo records. Editing continues at `?edit=1` with the existing OAuth and API deployment IDs. The privacy release changes only `manageAccess_` in this API: owner and already-authorized editor roles can administer read-only links. Journal CRUD, record preconditions, pending-save recovery and Sheet permissions are preserved. Update the existing API deployment to the tested candidate version before enabling the new sharing UI. No new Google scopes are required.
