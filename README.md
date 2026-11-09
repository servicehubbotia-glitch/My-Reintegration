# My Reintegration

A lightweight weekly reintegration journal hosted on GitHub Pages. Activities and applications are stored in the owner’s original private Google spreadsheet through an OAuth-authorized Apps Script API executable. Local storage holds drafts and pending-save recovery; it is not the shared database.

**Public read-only access:** Open https://servicehubbotia-glitch.github.io/My-Reintegration/ — the read-only journal stays at this permanent address and loads the latest records from the public reader service without a Google login. Anyone with the URL can see activities, applications and reports; no Google account is required. The public viewer cannot create, edit or delete records. Its read-only service does not disclose the private report-recipient setting. Application fields, including contact details entered in records, remain visible in the viewer.

**Authorized editing:** Open https://servicehubbotia-glitch.github.io/My-Reintegration/?edit=1 and choose **Connect Google** with the authorized personal or maintenance account. Both can create, edit, delete and migrate records. The server checks the real owner plus the private `EDITOR_EMAILS` list and each account's write permission on the same original Google Sheet. The underlying Sheet remains Restricted; never make it public. Guests use the separate public read-only viewer and cannot edit. Account identities belong only in private Google configuration, never in this repository.

## Reports

Choose any Monday–Sunday week, or **All data & downloads**, to copy a report or download a spreadsheet, PDF or CSV. The public journal opens the most recent recorded date. **Share link** preserves the selected date with `?date=YYYY-MM-DD`. The owner editor also provides JSON backups and editable email drafts. XLSX uses one worksheet with the two sections and headings extracted from the supplied Randstad template. Dates and durations are real Excel values; application counts do not add hours. Row heights follow text length; exceptionally long text continues in extra rows without duplicating duration. All-record exports contain only activity and application report fields, not internal settings or access logs.

## Recovery and migration

Existing `my-reintegration-v1` records are never deleted. Settings includes a legacy JSON backup and merge migration. Export a backup before migration. Conflicting IDs receive deterministic new IDs rather than overwriting cloud entries. Pending saves retain their request ID for safe retry after interruption. Each change carries its original record, so a direct Sheet change to another record does not invalidate the save. Older pending requests are retried with their original ID first; only a confirmed conflict can trigger a checked retry of unchanged targets. A real collision keeps the pending changes for review. **Saved** appears only after service confirmation. Browser drafts and recovery may be lost when local browser data is cleared.

## Implementation

Vanilla HTML, CSS and JavaScript; no build step or analytics. Public OAuth/deployment IDs are in `google-config.js`; no client secret or tokens are stored in the repository. Owner OAuth tokens stay in memory. The separate read-only service supplies a constrained JSONP response to GitHub Pages. Its callback is a strictly validated single identifier; payload strings are escaped. The legacy Apps Script link continues to serve the same rebuilt interface. It asks for no account or access code. Reports, downloads and day/week navigation use the confirmed loaded snapshot immediately, without a redundant network request for each click. **Refresh** loads the latest records; a failed read clears the unavailable view. Network requests have a timeout, one retry for transport failures and clear failure messages. Owner editing remains separate. Apps Script uses identity checks, private sharing checks, revision conflicts, locks, atomic writes, request receipts and explicit cell string values.

See [Apps Script setup](apps-script/SETUP.md) for deployment, scopes and remaining live checks. The app and direct Google Sheets writes use one dataset. Google Sheets writes made outside the app do not participate in the script lock: record preconditions detect changes present when the save reads the data, but cannot make an external write between that read and the Sheets batch atomic. Direct automation should write only the intended cells, preserve IDs and read back its result.

## Validation

`tests/backend.cjs` checks service authorization, per-record preconditions and persistence logic with isolated doubles. `tests/google-store.cjs` checks authorized editor writes and pending recovery, including unrelated direct Sheet changes and real conflicts. `tests/cloud-browser.cjs` runs desktop/mobile UI, CRUD, reports, simulated editor/reader and recovery tests against simulated Google transport; it does not prove live OAuth or cross-device access. `tests/excel.cjs` produces an isolated XLSX fixture. GitHub Actions runs these checks before publishing.

Release status: published on GitHub Pages. Live OAuth/API reads and settings writes to the original private spreadsheet are verified. Two independently authenticated app tabs retrieved the same settings and exported valid XLSX files. Real record CRUD was verified in temporary isolated tabs in that same spreadsheet, which were removed. Reader access has not been granted; reader restrictions are tested with isolated fixtures. Legacy migration remains available in the browser holding the original data. The original workbook and personal records are excluded from the repository.

## Publication boundary

GitHub Actions publishes the public UI and the owner editor together, including `guest-store.js` and `guest-view.js`. It builds the legacy Apps Script `View.html` and validates both transports. The Apps Script guest backend is an independent deployment: when `Guest.gs` or the legacy view changes, update the **existing** deployment to a new version, retaining its URL and anyone-read access. Do not replace it with another project or make the source spreadsheet public.

The 9 November 2026 repair added the stable public reader, dated share links, latest-record initial view, complete-period exports and fully visible spreadsheet text. Unit checks cover the reader/owner boundary, JSONP validation, timeouts, callbacks, exports and data preservation. Production verification is performed against the deployed URLs and downloaded files.
