# LeafAtlas — Patient Understanding Audit

**Version 1.0.0 · 19 November 2026 · approved questionnaire wording**

This is the source-code package for an actual, server-backed Netlify website. It is **not a Netlify Drop static ZIP**: the response saving and Results Dashboard require Netlify Functions and Netlify Blobs. Deploy using Git integration or Netlify CLI with the entire project root.

## What works once deployed and configured

- Your genuine, founder-supplied LeafAtlas logo.
- Five approved parent questionnaires with 10 fixed questions each (8 T/F/Not sure and two 0–10 confidence scales).
- Ten staff-generated, signed QR links, one for each topic and study group; the browser URL stays bound to the correct topic, group and version.
- Direct patient scan-to-Question-1 flow with Back, progress and accessibility features.
- A real `POST /api/submit` endpoint for centrally saved parent responses, with one UUID per completed response and safe retry handling.
- A restricted **Results dashboard**: baseline vs LeafAtlas sample sizes, ≥6/8, mean score, confidence means, Q1–Q8 counts, per-topic filters.
- Restricted, filtered individual response CSV export and aggregate CSV export.
- No direct identifiers, no localStorage clinical database, no frontend answer key and no synthetic/example result controls in the live UI.
- Collection refuses submissions if the required Netlify environment settings are not enabled. The patient cannot be shown a false recorded-success message.

## IMPORTANT before you use this with families

The founder has confirmed Trust approval for the QI project. Approval of the QI protocol **does not by itself establish that Netlify Blobs, Frankfurt EU storage, shared-key staff authentication, or this specific implementation are within that approval**. Check the Trust approval scope and local requirements for supplier, processing agreement, access controls, backup/retention and incident response. Netlify Blobs has a Frankfurt (`eu-central-1`) region, **not a UK Blobs region**. There may still be provider or infrastructure logs outside the application data.

The supplied staff gate uses a random shared access key, not Microsoft Entra per-user SSO/MFA. Do not introduce real patient response collection unless that access approach is accepted in your local security review; for a broader Trust rollout, replace it with Trust SSO/MFA. QR codes are public invitations, so they cannot prevent a person submitting another response on a different browser. Use the clinic administration process to maintain group integrity.

The code has been tested locally against an in-memory simulation of the Netlify Blobs API and in an isolated browser. **It has not been deployed to your Netlify account or tested against real cloud storage**. Complete the live acceptance checklist before patient use.

See **DEPLOY_NETLIFY.md** for exact steps, **TEST_REPORT.md** for tested behaviours, and **OPERATIONAL_NOTES.md** for ongoing management.

## Files

- `public/` — parent and staff HTML/CSS/JS (deployed to visitors).
- `netlify/functions/` — signed QR, submission, status, results and export endpoints.
- `server/` — server-only scoring answer key, schema and storage code; must NOT be placed under `public/`.
- `tests/` — automated API tests and mocked offline browser UI test.
- `.env.example` — sample variable *names* only. Never upload an `.env` with real secrets.
- `netlify.toml` — serverless build and security header settings.

## Run tests locally

```bash
npm install
npm test
npm run build
```

The `npm test` suite mocks Netlify Blobs with an in-memory store. No patient data are read or written by these tests.

For a separate browser layout check, run `python tests/browser-smoke.py` in an environment with Playwright and Chromium. It mocks network calls and cannot establish a successful live deployment.

## Netlify Function routing fix — 20 Nov 2026

Browser requests now call `/.netlify/functions/{name}` directly instead of assuming that `/api/*` rewrites are active. We also ship `public/_redirects` for compatibility. This change does not alter approved questionnaires, scoring or stored response structure.

A response such as `{"collectionEnabled":false}` from `/.netlify/functions/status` proves the function is reachable, but **does not mean that live submission is enabled**. Check the following six production Function environment variables, all of which are required by `server/core.mjs`: `AUDIT_PUBLIC_ORIGIN`, `STAFF_ACCESS_KEY`, `QR_SIGNING_SECRET`, `CLINICAL_QI_IG_APPROVED=YES`, `AUDIT_ENVIRONMENT=production`, and `RESPONSES_ENABLED=true`. The public origin must be the exact HTTPS origin you visit, with no path or trailing slash. Redeploy after changes.

Do not create another Netlify site for this fix if you already have one: update the files in the connected repository and redeploy the **same site**, preserving existing environment variables and stored responses. Do not rotate your signing key unnecessarily, since QR links use it.
