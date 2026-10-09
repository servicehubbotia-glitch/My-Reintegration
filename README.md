# My Reintegration

A responsive, English-language reintegration journal built with HTML, CSS and JavaScript. No build step, backend, analytics, external fonts or runtime dependencies. Records start empty.

## Use

Open the GitHub Pages site. Choose a date in the Monday–Sunday calendar and add one or more activities. Hours are stored as integer minutes, including time spent on incomplete activities. The weekly target starts at 20 hours and can be changed in **Settings & backup**.

**Ongoing applications** lists all applications. Weekly reports filter applications by their application date; interviews remain included as details of those applications. All original requested Randstad / Tempo-Team fields are preserved. Categories are optional. Activity durations do not get added again through application records.

**Weekly report** provides clipboard copy, a downloadable PDF, CSV, an editable English email and an `.eml` draft. The PDF is rendered locally as high-resolution page images, preserving international characters; its text is not selectable. CSV and clipboard exports provide searchable text. No email is sent automatically. Opening an email app does not automatically attach downloads; attach the PDF there if desired. Long mailto URLs may be truncated by email clients; use the `.eml` download or attach the PDF instead.

## Privacy and persistence

Activity records, application records, settings and unfinished editor drafts live in localStorage, on this browser and origin only. They are not uploaded or synced. Clearing browser data, private browsing, switching browsers/devices or changing the Pages URL can make them unavailable. Export JSON backups regularly using Settings & backup. Backups include saved records and settings, not unfinished drafts. Keep backups private.

The public repository contains application code and synthetic test cases, never actual personal records. Recipient email and name are configured locally. An optional `#recipient=...` URL fragment supports first-use setup without putting the recipient into source code or sending it to the static host; the app removes the fragment after initialization. GitHub receives ordinary requests for static files, but the app makes no network requests for record data.

Drafts are saved while typing, separately by record or new-record date. Close and reopen the editor to restore a draft. Saving commits a record; discarding only removes that draft. Simultaneous-tab updates are detected and stale saves are blocked to avoid silent overwrites.

JSON import validates schema, dates, identifiers and minute values, asks for confirmation, downloads the current saved data first and then replaces it. CSV export quotes every field and neutralizes spreadsheet formula prefixes.

## Development and validation

Serve this directory with `python3 -m http.server 8765`. There is no compilation step. Test tooling is used only by GitHub Actions and is never published with the application.

`tests/browser.cjs` exercises desktop and mobile workflows, persistence, draft restoration, CRUD, week navigation, arithmetic, reports, CSV, PDF and JSON. The GitHub Actions workflow uploads screenshots and test evidence, then publishes only `index.html`, `style.css`, `app.js` and `.nojekyll`.

## GitHub Pages

The workflow targets the `main` branch and the `github-pages` environment. If automatic initial setup is denied, select **Settings → Pages → Build and deployment → Source: GitHub Actions**, then rerun the workflow. GitHub's standard workflow token may not have the repository administration permission needed for first-time enablement.
