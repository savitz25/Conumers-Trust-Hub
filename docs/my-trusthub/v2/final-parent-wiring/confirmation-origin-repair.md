# Final confirmation Origin repair

Parent: `3dd44717ac3e9ae2da873024e657ceed604d0431`. One product change in browser.ts: confirmation HTML overrides the shared Referrer-Policy with `same-origin`. API/redirect headers remain unchanged. No SQL or authority design changes.

## Proven defect

The rendered native form inherited `Referrer-Policy: no-referrer` from PRIVATE_HEADERS. Chromium's native same-origin POST therefore sends `Origin: null`. The exact-Origin validation in handleProfileConfirmation rejects it after b.projects and before contextCandidateRef is assigned. This reproduces the reported 503, empty transaction context and zero Saves without Vercel in the path. Hand-built Request tests had explicitly supplied the desired Origin and missed the browser-generated header.

The fix changes the document policy, not origin admission. Null, absent/wrong Origin and cross-origin final confirmation remain rejected. Same-origin requests retain their Origin; cross-origin referrers are still suppressed. The confirmation URL rejects query parameters, and the policy does not send form fields, cookies or CSRF as referrer information. CSP form-action self, exact Origin equality, CSRF, account/session checks, Project ownership, P13, idempotency and receipt binding are unchanged.

References: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy and https://fetch.spec.whatwg.org/#append-a-request-origin-header .

## Reproduction and negative coverage

scripts/qa/v23-confirmation-form-browser.mjs runs Chromium OFFLINE with all application requests fulfilled locally. The fixture first executes URL-encoded continuationRef POST -> 303; the browser receives its confirmation cookie, GETs the actual rendered page, checks the required checkbox, leaves No Project selected and submits the native form. Identity is move / usdot-1002530. Auth, source and SQLite persistence are explicit local fixtures; no hosted certification is implied.

Both policy controls use the exact Ask preview origin, valid 43-character stored CSRF, confirm=yes, project empty, a bound parent, unexpired source and zero Projects:

| Document policy | Browser Origin | Final response | Context checkpoint | Local Saves |
|---|---|---|---|---|
| old no-referrer control | null | 503 | not reached | 0 |
| repaired same-origin | exact ASK_PREVIEW | 200 | reached, Project undefined | 1 |

The browser script prints only bounded booleans/counts/status, never form values or identity/session secrets. Supply V23_BROWSER_DRIVER_MODULE as a local playwright-core module URL and V23_BROWSER_EXECUTABLE as the local Chromium path, then run `node --experimental-strip-types scripts/qa/v23-confirmation-form-browser.mjs`. No new npm alias or dependency was added.

browser.test.ts covers valid zero-Project confirmation, missing confirm, wrong CSRF, wrong/null Origin, duplicates of each permitted key, unknown key, unknown Project, account switch and expiry. Denials do not reach the context checkpoint or create Saves. Existing idempotency and optional Project failure tests remain.

The disposable PostgreSQL harness verifies fresh verifiedParent attestation -> preview_session_live true -> preview_projects zero rows -> PreviewAssembly.projects []. It retains the actual P11/P12/P13 integration and isolation checks.

The original hosted request headers and Deployment Protection forwarding were not inspected or changed. The application defect is independently reproducible with the edge absent. Hosted retry remains blocked pending G-B2 review; no User A/B retry, SQL apply, service configuration change, manual deployment, merge or production action was performed.

## Validation

- Offline Chromium: old-policy negative control and repaired native form PASS.
- Browser/profile-save tests: 19/19 PASS.
- check:my-trusthub-v2-3-final-parent: PASS (37 focused tests, disposable parent SQL/P13/zero-Project integration, 44 packet assertion negatives, teardown preservation, 72 session-readiness negatives, upgrade/rollback and HMAC controls).
- check:my-trusthub-v2-3-runtime: 17/17 PASS plus local Move HTTP harness.
- check:my-trusthub-v2-3: 41/41 PASS.
- check:my-trusthub-v2-3f: 3/3 static tests plus disposable PostgreSQL integration PASS.
- npm run typecheck: exit 0.

No production or hosted PASS is claimed. PR #185 must remain OPEN, DRAFT and UNMERGED pending G-B2 review.
