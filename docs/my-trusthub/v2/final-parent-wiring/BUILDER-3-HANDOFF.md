# V2-3 final parent wiring — isolated transport v1

Prior Move #156/#157 browser and release evidence is retired for final V2-3 composition. This remains the Ask-side transport target; Builder 3 must implement and certify it from current Move main before Journey QA.

Prepared from Ask `307da0b6f80f0b1635811f2b91f39b737b9f0afc`, in branch `mth-v2-3-final-parent-wiring`. The implementation is local and unapplied. No deployed/browser PASS is asserted. Builder 3 can implement against this packet; coordinated activation still needs the SQL, secrets and both preview deployments.

The parent now assembles `AuthorizedPostgresBackend` and `ParentProfileSaveRuntime` with real PostgreSQL state. `/my/profile-save` uses durable confirmations, verified admitted parent Auth, actual P13 issuance/consume, exact network binding, P12 Save, receipt persistence and authenticated source acknowledgment. `/my/saved` has a Save-only isolated view so missing Sessions/Watch schemas cannot block the saved-list read. The six-operation parent wire envelope and vendored contracts are unchanged.

## Exact pair

| Side | Canonical origin |
|---|---|
| Ask | `https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app` |
| Move | `https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app` |

Ask uses the user-specified stable branch alias. This packet proposes the existing Move branch alias as its sole counterpart, for the same rebuild-stability reason. Builder 3 must use this exact pair in the eventual isolated packet and verify the intended SHAs behind both aliases before JQA. The prior immutable Move deployment remains the provenance of the fresh publication observation; it is not an additional trusted transport origin. No wildcard, suffix allowlist, arbitrary return origin, production origin or production database is accepted. No alias or deployment has been changed by this work.

## Service assertions

Use the executable `lib/my-trusthub/profile-save/service-assertion.ts` as the verifier/signing reference. Two independent Ed25519 key pairs are required, one per service. Private keys stay on their signing server. Public keys are provisioned on the peer through the reviewed secret/config channel; no network key discovery or `jku`/`jwk` header is accepted.

Carrier: HTTP header `x-trusthub-v23-assertion`. Value: compact JWS `base64url(header).base64url(claims).base64url(signature)`, without padding. Sign the ASCII first two segments joined by `.` using Ed25519 (`crypto.sign(null, bytes, privateKey)`); verify with `crypto.verify(null, bytes, publicKey, signature)`. Header is exactly `{"alg":"EdDSA","typ":"trusthub-v23+jws","kid":"<configured-key-id>"}`. No algorithm negotiation.

| Claim | Exact rule |
|---|---|
| `v` | `1` |
| `iss` | Ask: `urn:trusthub:v23:xkkiicsassizmakcvxml:ask`; Move: `urn:trusthub:v23:xkkiicsassizmakcvxml:move` |
| `sub` | Ask: `svc:trusthub:ask:v23:isolated`; Move: `svc:trusthub:move:v23:isolated` |
| `aud` | Full receiving URL, including the fixed callback/API path; no query or fragment |
| `scope` | One exact operation scope from the table below |
| `method` | `POST` |
| `path` | Receiving URL pathname, exactly |
| `body_sha256` | Lowercase hex SHA-256 of the exact UTF-8 HTTP body bytes, before JSON parsing; never reserialize for verification |
| `iat`, `exp` | Integer Unix seconds; `exp=iat+30`, reject expired and `iat>now+2`; no expired-token grace |
| `jti` | Fresh cryptographically random 32 bytes, unpadded base64url (43 characters) |
| `ask_origin`, `move_origin` | Exact pair above |
| `browser` | Move BFF's verified 43-character HttpOnly browser binding; never a posted UUID/localStorage subject |
| `session` | `null` for guest/read/challenge traffic; SHA-256 hex of verified parent Auth session ID for acknowledgment and receipt traffic |
| `grant` | `null` except parent receipt API calls, where it is the fresh opaque `proofRef` from the current-grant bridge |

No other header fields or claims are accepted. The session hash is an association, not authority by itself. No canonical user UUID or raw Auth JWT travels in these assertions.

| Direction / receiving path | Request | Scope |
|---|---|---|
| Ask → Move `/api/my-trusthub/profile-save/source` | `action: resolve` or `action: source` | `source:read` |
| Ask → Move same callback | `action: acknowledge` | `source:ack` |
| Move → Ask `/api/my-trusthub/profile-save` | `prepareGuestProfileTransfer`, `prepareProfileSaveContinuation` | `transfer:stage` |
| Move → Ask same API | `getProfileSaveReceipt`, `verifyProfileSaveReceipt` | `receipt:verify` |
| Move → Ask `/api/my-trusthub/profile-save/current-grant` | `action: binding` | `transfer:stage` |
| Move → Ask same current-grant API | `action: challenge`, `action: resolve` | `receipt:verify` |

Replay: after signature, claim and request checks, atomically claim `SHA256(iss + ':' + kid + ':' + jti)` through a durable receiver-side nonce store. Retain until `(exp+2)*1000` milliseconds. Exactly one concurrent claim may succeed. A failed nonce store makes the request unavailable/denied; no memory fallback. Parent implements this with `PreviewStore.claim`, exact-key RLS and an advisory transaction lock. Move must install its corresponding durable source-side nonce operation before activation. Never use parent DB credentials on Move. A retry gets a new signed assertion and nonce; application request keys remain unchanged for idempotency.

HTTP uses exact HTTPS targets, `redirect: error`, `cache: no-store`, a 5-second outbound timeout and bounded bodies. Source response cap is 131072 bytes; parent facade cap is 65536; current-grant service cap is 4096. No CORS/browser-token fallback. Requests to parent service APIs with an `Origin` header are denied. Optional Vercel protection bypass credentials are separate from service assertions and sent only to the fixed peer host; the bypass cookie is never forwarded.

Errors: `400 invalid` for malformed/bound-shape input; `403 unauthorized` for missing/forged/replayed assertions, wrong service/scope/origin/browser/session/account; `410 expired` for expired workflow state; `409 conflict` for immutable state or application replay mismatch; `429 rate_limited`; `503 unavailable` for unverified/missing infrastructure or source ports; parent master gate OFF gives `404 disabled`. Parent returns `{ok:false,error}` with no-store headers and no provider/credential details. Existing Move callback must map assertion verification failure to its unauthorized response. No error implies a durable Save; retain the local copy.

## Exact server environment names

| Variable | Location / value type |
|---|---|
| `MY_TRUSTHUB_V23_ASK_KEY_ID` | Both services; reviewed Ask key ID |
| `MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM` | Ask only; Ed25519 PKCS#8 PEM secret |
| `MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM` | Move only; corresponding SPKI public key |
| `MY_TRUSTHUB_V23_MOVE_KEY_ID` | Both services; reviewed Move key ID |
| `MY_TRUSTHUB_V23_MOVE_SIGNING_PRIVATE_KEY_PEM` | Move only; separate Ed25519 PKCS#8 PEM secret |
| `MY_TRUSTHUB_V23_MOVE_VERIFY_PUBLIC_KEY_PEM` | Ask only; corresponding SPKI public key |
| `MY_TRUSTHUB_V23_PARENT_DATABASE_URL` | Ask only; dedicated isolated runtime login connection secret |
| `MY_TRUSTHUB_V23_DATABASE_CA_PEM` | Ask only; trusted database TLS CA PEM |
| `MY_TRUSTHUB_V23_MOVE_PROTECTION_BYPASS` | Ask only, if Move preview protection requires it |
| `MTH_MOVE_PARENT_SAVE_PARENT_PROTECTION_BYPASS` | Move only, if Ask preview protection requires it; Builder 3 adapter must add this exact name |

None of the signing/connection/bypass variables has a `NEXT_PUBLIC_` prefix. Generate only preview keys; do not reuse production material or consumer credentials. No key values are in this packet. See [preview environment packet](preview-env.md) for the nonsecret flags and exact account origin correction.

## Source callback additions Builder 3 must implement

`source` and `acknowledge` retain Builder 3's existing JSON bodies and `{ok:true,result}` / `{ok:true}` responses. `verifySourceCaller` must verify the bounded reconstruction against the above algorithm and persistent nonce store, then return `{browserProof: claims.browser}`. Acknowledgment requires `session` to be a session hash, and `grant:null`; source reads require both to be null. The source store still compares `hash(browserProof)` with its stored browser hash.

Add `resolve` to the same callback:

```json
{"action":"resolve","profile":{"hub":"move","nativeId":"usdot-1002530","profileClass":"mover"}}
```

Return only the exact current source result:

```json
{"ok":true,"result":{"identity":{"hub":"move","nativeId":"usdot-1002530","profileClass":"mover"},"canonicalSlug":"hindman-isaacs-moving-storage-inc","publicationState":"PUBLISHABLE","reviewedClass":"mover","checkedAt":0}}
```

`checkedAt` above is a schema example; real responses must contain current Unix milliseconds from an actual current publication read. Parent rejects a timestamp older than 5 seconds or more than 2 seconds ahead. Do not promote `INDEXABLE`, legacy publication-null, public page visibility, or a browser claim to `PUBLISHABLE`. The callback reads public source identity/publication directly; it must not recursively call parent binding/currentGrant or require an already-created stage. That independence prevents an activation loop.

To resolve the exact parent identity for Move's `resolveExactPublished`, call parent current-grant API with `{"action":"binding"}` and guest `transfer:stage` assertion. Result is `{profile,binding:{id,networkEntityId,status:"accepted"}}`. The parent rechecks source publication and the single approved network binding. This is a separate service metadata endpoint, not a change to the frozen six-operation envelope. Neither peer gets direct access to the other's private store.

## Browser handoff and current grant

1. Move creates its verified HttpOnly browser binding and resolves the exact published/bound mover. Its existing parent facade stages `v2-3/selected-profiles/2`, then obtains a continuation. Parent stores a durable continuation-to-browser/manifest link. Both stage calls use fresh `transfer:stage` assertions.
2. Move submits an HTML form with only `continuationRef` to Ask `/my/profile-save`. Parent authenticates Move's source callback, validates the exact manifest and sets its durable confirmation cookie. The 303→GET transition allows the parent SameSite=Lax Auth cookies to arrive.
3. Parent verifies `getUser`, SDK-verified `getClaims`, exact isolated issuer, matching subject/session, A/B admission and the live `auth.sessions` predicate. It displays an explicit checkbox and optional opaque Project references. A browser Project UUID or subject is never accepted as authority.
4. Only the checked POST with its server CSRF token creates the actual P13 auth intent/handoff from the verified source plus parent session. The server checkpoints a random context candidate, consumes P13 once inside the authorized backend transaction, then commits P12 Save and receipt atomically. A retry resumes that exact current session's committed context. Parent acknowledgment sends actual receipts to the authenticated Move callback.
5. `CurrentGrants.remember` runs only from this verified parent confirmation after durable receipts/P13 context exist. The acknowledgment endpoint cannot create a parent grant.
6. **On every Move finish/reverification attempt**, its BFF requests `{"action":"challenge","continuationRef":"<source-held-ref>"}` at parent current-grant API, with `receipt:verify` and null session/grant claims. The source-held continuation must belong to the BFF's browser/ticket record. Parent returns `{target,fields:{challengeRef}}` with a 90-second challenge.
7. Move opens a user-initiated top-level popup and form-POSTs those fields to the exact Ask target `/my/profile-save/current-grant`. Parent sets a 90-second HttpOnly, Secure, SameSite=Lax cookie scoped to that path and returns 303 to GET. The GET reads the **current parent browser Auth session**, burns the challenge, invalidates the previous proof for that Move browser, and checks the immutable confirmed owner. Absent/mismatched account is denied; the user restarts the confirmation. No sign-in or account is inferred from the old receipt.
8. Successful GET sends `window.opener.postMessage({type:"v23-current-grant",proofRef}, EXACT_MOVE_ORIGIN)` and closes. Parent returns `Cross-Origin-Opener-Policy: unsafe-none` and nonce CSP. Move must preserve the opener for this reviewed popup, validate `event.origin===EXACT_ASK_ORIGIN`, `event.source===thatPopup`, exact message keys and an outstanding attempt, then send `proofRef` to its own BFF with its existing CSRF/browser protections. No canonical user/session UUID is in the message or URL. Popup blocking/closed opener is unavailable, never success; local data stays.
9. Move BFF resolves `{"action":"resolve","continuationRef":"<source-held-ref>","proofRef":"<opaque-proof>"}` through the same parent service endpoint. Result is `{accountContextRef,selectionConfirmed:true,sessionBinding:<hash>,expiresAt,projectRef?}`. The BFF retains the full transport result server-side and returns only its existing `CurrentGrant` shape internally to the adapter. Do not cache it across finish attempts or derive it from localStorage, query fields, Move legacy Auth or acknowledgment.
10. Parent receipt facade calls use `receipt:verify`, `session:sessionBinding` and `grant:proofRef` in each newly signed assertion. Parent rechecks the live session, current proof and exact browser/context/request prefix before and after DB work. Proofs expire in 30 seconds. A newer parent recheck supersedes the prior proof; B switching or sign-out invalidates A's authority. A newly signed-in session of the **same owner** can recover an existing retained receipt, but cannot renew an expired Save/commit grant.
11. Parent only permits stage and receipt operations over the service facade. The parent confirmation owns `consumeProfileSaveContinuation` and `commitProfileSave`. If the Move fallback tries a missing-receipt commit, it receives unauthorized; keep the local copy and retry the parent confirmation. Acknowledgment by itself never yields UI success. Existing Move finish must still retrieve and verify every receipt against manifest, item/revision/digest, Project and request key.

The callback and browser bridge must be wired and tested on actual previews before a Journey QA PASS. In particular, verify opener policy/CSRF/keyboard behavior in the real Move frontend and fresh A→B switching; local HTTP/SQL tests do not substitute for those checks.

## Database authorization boundary

[Private ports](ports-forward.sql), [dedicated runtime login](runtime-role-forward.sql), [exact Move identity](move-binding-forward.sql), [read-only assertions](assertions.sql), and [teardown](teardown.sql) are prepared files, not migrations registered for automatic deployment. The login has only SET-capable, non-inheriting, non-admin memberships in `myth_v23_authorizer` and `myth_v23_executor`. Confirmation/private session/P13/list operations use narrow security-definer wrappers owned by nonlogin roles; the login receives no membership in those owners and no raw table grants.

New private ports, the exact-session RLS policy on `auth.sessions`, and isolated P13 staging-origin updates need explicit authorization and hosted recertification. No new public Auth user, schema exposure, service_role, postgres runtime credential, production env or production registry change is part of the packet. The GUC guards are operator attestations, not host identity verification: the approved runner must independently pin `xkkiicsassizmakcvxml` before any mutation and use `ON_ERROR_STOP`.

The local PostgreSQL suite exercises actual P11/P12/P13, these new SQL ports and role ACLs, durable nonce replay, explicit confirmation, receipt/list isolation and teardown. It uses fixture Auth/source HTTP and cannot certify hosted Supabase permissions or browser behavior. Hosted verification in this task was read-only.

References for the transport/role implementation: [Node crypto signing/verification](https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback), [PostgreSQL role membership options](https://www.postgresql.org/docs/17/role-membership.html), [Supabase server-side Auth guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
