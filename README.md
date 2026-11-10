# My Reintegration

A weekly activity and application journal with two deliberately separate uses:

- **Public demonstration:** the permanent GitHub Pages address opens an interactive journal containing only fictional examples. Visitors can try editing, navigate two sample weeks, and download clearly labelled demo reports. All changes are in memory and disappear on reload or Reset. The demo makes no Google/OAuth/Apps Script requests and does not read browser storage or the original spreadsheet.
- **Private journal:** the same original restricted Google Sheet remains the source of truth. Authorized Google identities use `?edit=1` to edit the real journal. A separate private, revocable read-only link allows its intended holder to consult and download **all weeks**.

## Addresses and roles

- Public demo / professional portfolio: `https://servicehubbotia-glitch.github.io/My-Reintegration/`
- Authorized editing: `https://servicehubbotia-glitch.github.io/My-Reintegration/?edit=1`
- Private read-only access: generated from **Share private access** in the authenticated editor. The link uses the existing Apps Script reader deployment, with its secret in a URL fragment. Do not put private links in the public repository, portfolio or screenshots.

The existing source Sheet remains Restricted. The owner account maintains the application; the authorized personal account edits the journal. Both authorized editing roles can create and revoke read-only links. An authorized reader cannot write or administer access. Direct Google Sheets automation and the editing app continue using the same rows and stable IDs.

## Private access

The private reader is an HTMLService application. It reads its fragment with `google.script.url.getLocation` and sends the token using `google.script.run.guestRequest`. Tokens never go into URL query parameters or browser storage. The registry stores only SHA-256 digests of `JSON.stringify(token)` and an expiry, revocation time and creation time. Links have a selectable expiry within one year. Anyone given a private link can use it until it expires or is revoked; it identifies a permission, not a person's Google identity.

Missing, malformed, unknown, expired and revoked credentials fail closed. Authorization is checked before reading activity records, after reading them and after writing the audit entry. Every authorized snapshot intentionally includes the complete history, as required for the report recipient. `settings.recipient` remains excluded. Logs contain a grant ID and fixed operation/result values, never tokens or record content.

The old anonymous JSONP path is closed, even if a caller supplies a valid token. `/exec` without credentials serves an empty shell and cannot retrieve records. There is no `doPost`, write bridge or access-management function in the reader project. Previously downloaded copies cannot be recalled; revocation controls subsequent server access.

## Editing and recovery

The owner/editor API retains its existing identity checks, restricted-sharing checks, per-record preconditions, atomic Sheets batches and idempotency receipts. OAuth tokens exist only in memory. Local drafts and pending-save recovery belong to the signed-in identity. A direct Sheet edit to an unrelated record is preserved; a conflicting edit to the same record is reported for review rather than overwritten.

Direct Sheet writers do not share the Apps Script lock. A change made between a server read and its write cannot be made atomic by these client preconditions. Automation should write only intended cells, preserve IDs and verify the result.

## Reports

Private readers can navigate the complete history, prepare a selected-week or full-history report, and download a spreadsheet or CSV using confirmed records. The application also retains the existing PDF/copy functions. All demo downloads include a visible fictional-data label and a `demo-` filename. Email preparation is available only in the real editor and never sends automatically.

## Build, tests and deployment

`node scripts/build-guest.cjs` generates `apps-script-guest/ReadHelpers.gs` and `View.html`. Do not edit generated files alone. The guest helper bundle contains only read validation, hashing and audit helpers, never the owner API, journal mutations or grant administration.

The workflows exercise the owner/editor backend and recovery, private authorization and revocation, demo isolation, desktop/mobile UI and report downloads with synthetic services. They never write test records to the real Sheet.

Apps Script and GitHub Pages are separate deployments. Follow [private reader deployment](apps-script-guest/SETUP.md) and [authorized API deployment](apps-script/SETUP.md). Keep the existing deployment identifiers. Prepare and verify a private recipient link before switching the public address to the demo; coordinate that recipient link with the owner. Publishing Pages alone does not close an older anonymous Apps Script deployment.
