# Private read-only journal

## Approved behaviour

The report recipient may consult and download every week. The public portfolio receives fictional demonstration data. The original restricted Sheet and authenticated editing service remain shared sources for all real records.

The existing reader web-app deployment remains executable as the deploying account and reachable without Google login, but **every data read requires an active private token**. Keeping the web-app shell reachable is necessary for a recipient without a Google account. Anonymous shell access does not authorize data access.

## Files and properties

1. Run `node scripts/build-guest.cjs` from the repository root.
2. In the existing reader project, replace `Guest.gs`, generated `ReadHelpers.gs`, generated `View.html`, and retain the reviewed `appsscript.json`.
3. Preserve private `SPREADSHEET_ID` and `OWNER_EMAIL` Script Properties, the advanced Sheets v4 and Drive v3 services, existing scopes and Restricted source sharing.
4. Never copy the owner `journal`, `manageAccess_` or mutation helpers into the reader project.

The registry is the original Sheet's existing `AccessGrants` tab (`Access ID`, `Token hash`, `Expires at`, `Revoked at`, `Created at`). `AccessLog` contains timestamp, grant ID, fixed operation and result. No real records, tokens or hashes appear in audit rows.

## Private links

The authorized editor creates links in **Share private access**. A 32-byte random token is encoded as 43 base64url characters. Its SHA-256 digest uses `JSON.stringify(token)`, matching the existing owner registry. Only the digest is saved to the Sheet; copy the generated private link before leaving the signed-in page.

A link has the form `EXISTING_READER_DEPLOYMENT#access=TOKEN&date=YYYY-MM-DD`. The date only selects the initial view; the active permission covers all weeks. The token is not a query parameter. HTMLService reads the top-level fragment through `google.script.url.getLocation`, then uses `google.script.run` for data. The Google-hosted iframe never relies on its own location fragment for the permission.

No JSONP response may carry real records. Requests containing a callback are rejected without reading the journal. Revoked, expired, missing and malformed permissions cannot load journal records. Reads recheck authorization so revocation during data loading or auditing fails closed.

## Release order and verification

- Verify the candidate with all isolated tests and browser flows first.
- Update the existing owner API version to allow both already-authorized editing roles to manage read-only links. Its data-writing authorization and personal editor configuration remain intact.
- Prepare the recipient's private link and retain it privately. Coordinate the link change with the owner; do not email anyone automatically.
- Update the **existing** reader deployment to the new version, preserving its deployment URL. Verify the private link opens the complete real journal, and anonymous/old JSONP reads return no records.
- Publish the public Pages demonstration and editor. Verify default/dated public URLs contain only fictional examples and no request to the real data service. Verify `?edit=1` remains the authorized editor.
- Check a historical week and an all-history download through the private link. Verify refresh, denied/revoked access and mobile rendering. Do not use live personal records as test fixtures.

Do not publish the frontend alone and describe the system as private: the backend restriction must also be deployed and checked. If publication needs to be paused, keep the tested candidate on its separate branch. Do not roll back to a reader version that releases the journal anonymously.
