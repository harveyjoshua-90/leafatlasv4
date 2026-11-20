# Deploy LeafAtlas QI to Netlify — step by step

**This is a Function-backed application. Do NOT deploy only the `public` folder using Netlify Drop.** That would show the website without working response collection.

### 1. Upload the complete source to a private Git repository

Unzip `LeafAtlas_Patient_Understanding_Audit_Live_Netlify_20261119.zip` onto your computer. Create a **private** GitHub repository and commit the project's contents (including `netlify.toml`, `server/`, `netlify/functions/`, `package.json`, `build.mjs` and `public/`). Do not commit real access keys, `.env` files or exported patient responses.

### 2. Connect Netlify

In Netlify, choose **Add new project → Import an existing project** and connect the private repository. Netlify will read `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Node version: 22 or newer, as specified in `package.json` and `.node-version`

Deploy once. On the initial deploy the UI will show that live response collection is not active; this is expected until credentials are configured.

### 3. Set the permanent primary address

Choose the permanent HTTPS address you plan to print on the QR codes, e.g. `https://leafatlas-audit.netlify.app` or an approved custom domain. Avoid using deploy-preview URLs or changing the domain later, because QR links are printed with the full URL.

### 4. Add environment variables in Netlify, for **production Functions**

In the project's configuration, open **Environment variables** and add:

| Variable | Example or action |
| --- | --- |
| `AUDIT_PUBLIC_ORIGIN` | `https://YOUR-SITE.netlify.app` — replace with the EXACT permanent origin, no path/trailing slash |
| `STAFF_ACCESS_KEY` | A cryptographically random 48+ character secret; mark secret |
| `QR_SIGNING_SECRET` | A **different** random 48+ character secret; mark secret |
| `CLINICAL_QI_IG_APPROVED` | `YES` |
| `AUDIT_ENVIRONMENT` | `production` |
| `RESPONSES_ENABLED` | `true` |

Generate two random values independently on a machine under your control, e.g. with Python:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Repeat the command for the second secret. **Do not paste secrets into this chat, GitHub, screenshots or the web page.** Scope them to production and make sure they are accessible to Functions (Netlify's `netlify.toml` is *not* a secret store and its environment values are not available to Functions).

After setting the variables, **trigger a fresh production deployment**. Updated variables are applied to Functions at deploy time. Keep `RESPONSES_ENABLED=false` on all non-production projects. Record the secrets securely in the Trust-approved credential manager.

### 5. Check the live service

Visit your real URL plus `/.netlify/functions/status` (the direct Netlify function address), for example:

`https://YOUR-SITE.netlify.app/.netlify/functions/status`

A correctly configured production site should return JSON containing:

```json
{"collectionEnabled":true,"questionnaireVersion":"1.0.0"}
```

If `collectionEnabled` is false, do not issue clinical QR codes: recheck the origin, keys, gate variables and new deploy. A 404 on the direct Function URL means that Function has not deployed. `/api/status` is also supported through `public/_redirects`, but the direct path does not depend on redirects.

### 6. Generate QR codes

Open the homepage at the approved domain. Enter the **staff access key**, choose the topic, choose the study group and click **Generate patient QR code**. Download the SVG or print. Repeat for each of the ten topic/group combinations. Do not give the staff key or staff dashboard URL to parents. You may generate the ten QR codes once and continue using them; do not rotate `QR_SIGNING_SECRET` without intentionally reissuing every QR code.

### 7. Prove real cross-device collection **before** patient use

1. Use a **separate test Netlify site** (or, if using the production site for testing, remove all test records before the first real patient); its store belongs to that Netlify site and remains separate.
2. Scan a signed QR on a phone, answer ten questions and submit.
3. Require the green/checkmark confirmation that answers **were recorded**.
4. On a separate staff device, visit `/dashboard.html`, enter the staff key and click **Load results**.
5. Confirm the correct topic/group count increased by exactly one, that the scores are plausible, and that **Export responses CSV** contains the submitted answers.
6. Test a second topic and intervention group, check that counts stay separate, and check that both CSV exports work.
7. Check anonymous access to `/api/summary` and `/api/export` returns 401. Confirm the shared access credential is governed by Trust rules.
8. Obtain the go-live evidence required locally (including that the storage region/provider and staff access model match Trust approval scope).

### 8. Ongoing operations

Only print QR codes after live storage has passed the cross-device test. Use `Results dashboard` for counts and export. Keep a backup under Trust-approved storage and follow retention policy. Do not use the static Netlify Drop preview ZIP for real surveys; that version has no live collection.

### Useful links

- Netlify Functions: https://docs.netlify.com/build/functions/get-started/
- Environment variables: https://docs.netlify.com/build/functions/environment-variables/
- Netlify Blobs, including regions: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
