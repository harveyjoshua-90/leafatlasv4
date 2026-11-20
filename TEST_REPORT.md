# Test report — 19 November 2026 · LeafAtlas v1.0.0

**Automated Node tests: 8 passed, 0 failed.** Run with `npm test`.

Coverage: five topics and ten-question versions; collection release gates; shared-key staff authorization; tamper-resistant topic/group/version links; signed QR verification; invalid/missing fields; real submission handler using an in-memory Netlify Blobs mock; repeat-submission idempotency; server-side correct-answer scoring and confidence means; private results; private per-response CSV; disabled collection cannot write.

**Chromium offline interface smoke: passed.** Run `python tests/browser-smoke.py` if you have Chromium and Playwright. Validated genuine logo, staff QR generator, signed-link interface, mobile one-question-at-a-time flow, Back preserves answers, successful confirmation, dashboard topic filter and correct table structure. A generated QR was also successfully decoded into its topic, group, version and signed URL. Browser API calls were stubbed: this is an **interface test, not a live Netlify/Blobs integration test**.

**Not tested in this environment:** authentic Netlify deployment into the user's account; live `@netlify/blobs` network persistence; actual mobile QR scan against the Netlify domain; load testing, penetration/security testing, complete accessibility certification, Trust SSO, geographic processing outside the configured Blob region or data protection impact assessment. These require a production/staging Netlify account and local Trust verification.

The code intentionally needs six production-only Netlify Functions environment variables and a **fresh production deployment** before real answer collection becomes active.
