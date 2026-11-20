# LeafAtlas Netlify live API routing — fix for 404 at /api/status

## Evidence from your Netlify test

- `/api/status` returned 404.
- `/.netlify/functions/status` returned `{"collectionEnabled":false,"questionnaireVersion":"1.0.0"}`.

That proves the function is deployed, but its short URL rewrite is not active; and collection remains switched off in the server settings.

## What I changed

1. `public/assets/admin.js`, `patient.js`, `dashboard.js`: all six API calls use Netlify's direct Function URLs.
2. Added `public/_redirects` to recover the optional `/api/*` rewrite.
3. Updated browser smoke tests and the deployment documentation.
4. No change to questions, answer keys, QR signatures or response schema.

## Deploy to the SAME Netlify site

Replace files in your existing connected GitHub repository with this package, keeping `netlify.toml`, `package.json`, `public`, `server` and `netlify` at repository root. Commit and deploy. Do not use a new Netlify project, change the primary URL, or rotate `QR_SIGNING_SECRET` if you already issued QR codes.

Set the production **Functions** environment variables via Netlify's UI, then deploy again:

| Name | Value |
| --- | --- |
| AUDIT_PUBLIC_ORIGIN | `https://YOUR-REAL-SITE.netlify.app` (exact HTTPS origin, no slash) |
| STAFF_ACCESS_KEY | secure random 32+ chars (48+ recommended; keep private) |
| QR_SIGNING_SECRET | different secure random 32+ chars (48+ recommended; keep private) |
| CLINICAL_QI_IG_APPROVED | `YES` |
| AUDIT_ENVIRONMENT | `production` |
| RESPONSES_ENABLED | `true` |

Never send the keys to anyone in chat or put them in code/GitHub. Ensure Netlify Functions scope and Production context. `RESPONSES_ENABLED` only enables collection if all other gates pass.

## Verify

1. Open `https://YOUR-REAL-SITE.netlify.app/.netlify/functions/status`. It should return `collectionEnabled:true`.
2. Reload your homepage. The Generate patient QR code button should become available.
3. Generate one QR using your staff key; scan from a second phone and submit a synthetic acceptance-test response.
4. Open Results dashboard from another device; confirm the new record appears and exports correctly.
5. Follow your Trust's agreed procedure for removing or flagging test records before real collection.

If status still says false, inspect Netlify's Function-scoped production environment variables; this is a configuration gate, not a missing Function. If it returns 500, inspect Netlify Function logs.
