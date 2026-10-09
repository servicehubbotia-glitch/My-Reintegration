# Authorized Google deployment

The owner-only API executable has been deployed and the original spreadsheet is Restricted. Live service tests passed for read/create/edit/delete, idempotent retry and literal formula handling in temporary isolated tabs; those tabs were removed. GitHub Pages OAuth/API connection, real settings writes, independent spreadsheet readback and recovery in a second authenticated app tab are verified. Downloaded XLSX files from both sessions were independently parsed. Reader identity access remains disabled; reader authorization tests use isolated fixtures. Original local-record migration is user-initiated in the browser where those records exist. No private workbook, account identity, spreadsheet ID, OAuth secret or token belongs in the public repository.

## Owner setup

As of 9 October 2026, version 2 of the owner-only API executable includes token grant management. Live creation, listing and revocation were verified. The separate token-based reader web app is deployed and verified; see [guest deployment status](../apps-script-guest/SETUP.md). Google-identity reader access described below remains disabled.

1. In the existing spreadsheet, change General access to **Restricted**. Keep its ID and folder. The service deliberately refuses a spreadsheet with anyone/domain permissions.
2. Open Extensions → Apps Script from that spreadsheet. Add `Code.gs` and the manifest from this directory. Configure Script Properties: `SPREADSHEET_ID` for the original spreadsheet and `OWNER_EMAIL` for its verified owner. Leave `READER_EMAILS` absent (no reader access).
3. Associate the script with a standard Google Cloud project owned by the user. Enable Apps Script API, Sheets API and Drive API. Configure the OAuth consent screen and authorize the owner as a test user where appropriate.
4. In that same Cloud project, create a Web OAuth client with JavaScript origin `https://servicehubbotia-glitch.github.io`. Use only its public client ID in `google-config.js`. Do not put a client secret in the app.
5. Authorize the script's scopes, deploy as an **API executable**, initially owner-only (`MYSELF`), and put the API executable identifier required by `scripts.run` in `google-config.js`. Do not deploy an anonymous web app. The front end calls the authenticated Google REST API, not an Apps Script `/exec` URL.
6. Verify from GitHub Pages that Google Identity Services popup authentication and `scripts.run` work with the deployed API and that the effective user is the signed-in owner. Do not infer these results from isolated tests.

Reference: https://developers.google.com/apps-script/api/how-tos/execute and https://developers.google.com/identity/oauth2/web/guides/use-token-model

## Data and migration

`Activities`, `Applications` and `Settings` use the exact headers in `Code.gs`. Preserve the original spreadsheet and any existing tabs. Dates are ISO strings; durations integer minutes. Writes use explicit string values so user text cannot become a formula. Transactions use a script lock, a revision check, an atomic Sheets batch, and a durable request receipt. External manual Sheets edits do not participate in the script lock; avoid editing the spreadsheet during an app save.

The app does not delete `my-reintegration-v1`. Export its JSON backup before migration. Migration merges by ID/content, preserves cloud rows, assigns deterministic IDs to conflicting records, and verifies the result. Failed saves retain an account-specific recovery envelope; tokens remain only in memory. Recovery files and browser drafts contain private information.

## Reader access — disabled until explicitly approved

After the owner explicitly authorizes a specific, verified Google identity, give that identity **Viewer** permission on the original sheet, add the exact email to `READER_EMAILS`, and configure an authenticated API-executable deployment compatible with that account. Verify it live. Do not grant public/link access. The backend rejects commits for every reader. A viewer can export all rows authorized by this dataset; it is not row-level access control.

## Release gate

- Verify authorized owner create/edit/delete and recovery after lost confirmation.
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
