# Operations & data handling

## What gets saved

A single JSON object is stored under a random UUID in a site-wide Netlify Blobs store called `leafatlas-qi-approved-responses-v1`, in the `eu-central-1` (Frankfurt) region. Each record contains:

- Random submission UUID (not a patient identifier)
- Received UTC **date** (not time of day)
- Questionnaire topic, study group and version
- 8 True/False/Not sure selections and 2 confidence ratings

It does **not** request a name, child's name, date of birth, NHS number, phone number, email address, postcode or clinical free text. Netlify/network logging may separately have connection metadata, so do not assume complete anonymity at the provider layer.

## Key management

- `STAFF_ACCESS_KEY`: restricts QR creation, dashboard summaries and CSV exports; maintain it using Trust secret management.
- `QR_SIGNING_SECRET`: binds the topic, group and version to each QR link. **Changing it invalidates all previously printed QR codes.**
- No secrets are served to the patient browser or included in `public/`.
- The question bank is in `public/`; the correct-answer key is only under `server/` and bundled into Functions.
- Current staff authentication is via a shared high-entropy key; it is **not** per-user Trust SSO or MFA. Replace it if the Trust requires named accounts and individual audit logging.

## Preventing invalid measurements

- Do not change question wording within version `1.0.0`; create a new version deliberately and revise scoring/reporting if needed.
- Baseline and LeafAtlas are two independent groups; do not claim paired before/after differences.
- The QR signature prevents switching group merely by changing a URL parameter. It does **not** stop a person forwarding the link or submitting twice from separate browser sessions. Use clinic recruitment procedures to avoid multiple responses per parent.
- The same browser page retries the same submission UUID after an error, preventing a double-count from a retry after an uncertain connection result.

## Reporting and exports

- The Results dashboard reads records from Netlify Blobs on demand using **strong consistency**.
- The primary result is the percentage with at least 6/8 correct. The CSV includes raw choices and scores. 'Not sure' counts as incorrect on each knowledge item.
- The two confidence questions are each averaged on a 0–10 scale separately.
- Dashboard request requires `STAFF_ACCESS_KEY` and returns no public data. Staff can filter topic and group.
- Exported CSVs must be handled in the Trust-approved environment, retained only under agreed policy and not uploaded to personal devices/cloud tools.
- The basic dashboard intentionally stops above 6,000 responses instead of timing out or silently showing incomplete data; large studies should migrate to an approved analytical database.

## Fail closed and maintenance

- If Netlify response collection is unconfigured or offline, the parent page will refuse to begin or will show a save failure rather than pretending answers were recorded.
- To pause collection, set `RESPONSES_ENABLED=false` in production Netlify environment variables and **redeploy**.
- Keep `AUDIT_PUBLIC_ORIGIN` stable; changing it affects printed QR codes.
- Store is **site-wide**: it persists across redeploys of the same Netlify site. The store does not automatically follow the Functions region; the code explicitly specifies Frankfurt on every access.
- Define a retention, access, backup and deletion procedure according to your Trust approval. The project does not automatically delete completed responses or create external backups.
- Verify Netlify account permissions and logs; avoid putting raw answers, tokens, client IP addresses or link signatures into application logs.
