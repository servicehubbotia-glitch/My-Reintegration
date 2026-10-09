# My Reintegration

A lightweight weekly reintegration journal hosted on GitHub Pages. Activities and applications are stored in the owner’s original private Google spreadsheet through an OAuth-authorized Apps Script API executable. Local storage holds drafts and pending-save recovery; it is not the shared database.

Open the app and choose **Connect Google**. The owner can create, edit, delete and migrate records. Reader access is disabled until the owner explicitly configures a verified Google identity and Viewer permission on the spreadsheet. Reader restrictions are enforced by the service as well as the UI.

## Reports

Choose any Monday–Sunday week to copy the report or download Excel, PDF, CSV, JSON or an editable email draft. XLSX uses one worksheet with the two sections and headings extracted from the supplied Randstad template. Dates and durations are real Excel values; application counts do not add hours. Exact source visual formatting remains to be compared with the original binary workbook.

## Recovery and migration

Existing `my-reintegration-v1` records are never deleted. Settings includes a legacy JSON backup and merge migration. Export a backup before migration. Conflicting IDs receive deterministic new IDs rather than overwriting cloud entries. Pending saves retain their request ID for safe retry after interruption. **Saved** appears only after service confirmation. Browser drafts and recovery may be lost when local browser data is cleared.

## Implementation

Vanilla HTML, CSS and JavaScript; no build step or analytics. Public OAuth/deployment IDs are in `google-config.js`; no client secret or tokens are stored in the repository. Tokens are memory-only. Apps Script uses identity checks, private sharing checks, revision conflicts, locks, atomic writes, request receipts and explicit cell string values.

See [Apps Script setup](apps-script/SETUP.md) for deployment, scopes and remaining live checks. Google Sheets edits made directly outside the app do not participate in the script lock.

## Validation

`tests/backend.cjs` checks service authorization and persistence logic with isolated doubles. `tests/cloud-browser.cjs` runs desktop/mobile UI, CRUD, reports, simulated reader and recovery tests against simulated Google transport; it does not prove live OAuth or cross-device access. `tests/excel.cjs` produces an isolated XLSX fixture. GitHub Actions runs these checks before publishing.

Release status: real Apps Script read verified; live integration and publication verification are in progress. Reader access has not been granted. The original workbook and personal records are excluded from the repository.
