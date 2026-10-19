# My Reintegration

A lightweight weekly reintegration journal hosted on GitHub Pages. Activities and applications are stored in the owner’s original private Google spreadsheet through an OAuth-authorized Apps Script API executable. Local storage holds drafts and pending-save recovery; it is not the shared database.

**Public read-only access:** Open https://servicehubbotia-glitch.github.io/My-Reintegration/ — it redirects to the separately deployed, login-free journal viewer. Anyone with the URL can see activities, applications and reports; no Google account is required. The public viewer cannot create, edit or delete records. Its read-only service does not disclose the private report-recipient setting. Application fields, including contact details entered in records, remain visible in the viewer.

**Owner editing:** Open https://servicehubbotia-glitch.github.io/My-Reintegration/?edit=1 and choose **Connect Google** with the authorized owner account. Only the owner can create, edit, delete and migrate records. The underlying Google Sheet remains Restricted; never make it public. Authenticated third-party readers of the owner API remain disabled, independently of the separate public read-only viewer.

## Reports

Choose any Monday–Sunday week to copy the report or download Excel, PDF, CSV, JSON or an editable email draft. XLSX uses one worksheet with the two sections and headings extracted from the supplied Randstad template. Dates and durations are real Excel values; application counts do not add hours. Exact source visual formatting remains to be compared with the original binary workbook.

## Recovery and migration

Existing `my-reintegration-v1` records are never deleted. Settings includes a legacy JSON backup and merge migration. Export a backup before migration. Conflicting IDs receive deterministic new IDs rather than overwriting cloud entries. Pending saves retain their request ID for safe retry after interruption. **Saved** appears only after service confirmation. Browser drafts and recovery may be lost when local browser data is cleared.

## Implementation

Vanilla HTML, CSS and JavaScript; no build step or analytics. Public OAuth/deployment IDs are in `google-config.js`; no client secret or tokens are stored in the repository. Owner OAuth tokens stay in memory. The separate read-only view opens directly for anyone with its shared link, as approved by the owner. It asks for no account or access code, and every read/export fetches a fresh snapshot. Owner editing remains separate. Apps Script uses identity checks, private sharing checks, revision conflicts, locks, atomic writes, request receipts and explicit cell string values.

See [Apps Script setup](apps-script/SETUP.md) for deployment, scopes and remaining live checks. Google Sheets edits made directly outside the app do not participate in the script lock.

## Validation

`tests/backend.cjs` checks service authorization and persistence logic with isolated doubles. `tests/cloud-browser.cjs` runs desktop/mobile UI, CRUD, reports, simulated reader and recovery tests against simulated Google transport; it does not prove live OAuth or cross-device access. `tests/excel.cjs` produces an isolated XLSX fixture. GitHub Actions runs these checks before publishing.

Release status: published on GitHub Pages. Live OAuth/API reads and settings writes to the original private spreadsheet are verified. Two independently authenticated app tabs retrieved the same settings and exported valid XLSX files. Real record CRUD was verified in temporary isolated tabs in that same spreadsheet, which were removed. Reader access has not been granted; reader restrictions are tested with isolated fixtures. Legacy migration remains available in the browser holding the original data. The original workbook and personal records are excluded from the repository.
