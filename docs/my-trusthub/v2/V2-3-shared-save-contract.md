# V2-3 shared specialist profile Save contract

Version: `v2-3/profile-save/1`. Prepared 2026-09-19 by Builder 4.

Status: READY FOR CONTRACT REVIEW; no specialist adapters/endpoints, migrations, permissions, credentials or production changes deployed. Executable specification: `lib/my-trusthub/contracts/v2-3-profile-save.ts`; deterministic reference-model tests: adjacent `.test.ts`. This is not a replacement identity system or a live API implementation.

## Invariants

Save is not Watch, endorsement or a ranking signal. Save does not disclose the consumer to the provider/business. Projects are optional. One Saved entity may belong to several Projects; membership creates no Watch. Save eligibility does not depend on Florida geography or state-specific Watch coverage. An eligible published New Jersey mover can be saved when a regulatory Watch grain is unavailable.

All six specialists use the existing parent identity: Move, Insurance, Lender, Contractor, Senior and Investor. Business Manager and specialist business roles are not consumer workspace authorization. Browser fields never select a consumer subject. Parent derives an admitted subject from verified authentication, and binds delegated operations to that subject and the current session/account context.

## Profile identity and capability

Input identity is the exact tuple `{hub, nativeId, profileClass}`. IDs are opaque and case-preserving; no fuzzy names, normalized email, geography, display label or client-provided network ID can substitute for the tuple. Parent resolves the reviewed network binding using trusted registry data and validates hub/native/class equality plus publication. Existing reviewed canonical redirects may resolve the entity; this is not permission to invent new merges.

| Capability | Meaning / permitted result |
| --- | --- |
| SAVE_SUPPORTED | Supported, published class with accepted exact network binding; parent Save permitted after authorization |
| SAVE_LOCAL_ONLY | Supported published profile lacks a reviewed binding/integration; local Save with honest disclosure |
| IDENTITY_REVIEW_REQUIRED | Existing binding requires review; this first-wave facade retains local data and does not invent a parent identity |
| PROFILE_NOT_PUBLISHED | Trusted publication check fails; no new parent Save; existing local research is not erased |
| UNSUPPORTED_CLASS | Record class not supported by reviewed specialist profile contract; no parent Save; do not discard existing research |

P12 already supports an explicit `review_required` saved state. A later reviewed adapter may expose that existing mode with an accurate label; this contract's initial facade conservatively keeps such items local. Neither choice grants Watch eligibility. No new product/profile taxonomy is introduced here; each specialist must supply its existing published class mapping before adapter enablement.

Watch capability is evaluated separately by the existing Watch contracts and explicit user action. It is not a required input to `profileCapability` and cannot be inferred from successful Save.

## Data flow and secure guest transfer

`specialist local Save → explicit selected profile manifest → bounded account continuation → verified parent session → exact binding/publication resolution → explicit selected Save → durable per-item acknowledgment → originating specialist task`

1. Anonymous Save persists locally using the specialist's existing storage contract and labels it “Saved on this device.” No registration, link email, account creation or cloud write occurs implicitly.
2. “Keep this in My TrustHub” is a distinct optional action. The specialist displays selected items and stages only their profile identities, local item IDs, revisions/digests and a bounded return-context reference. Unselected items, notes and tool payloads do not accompany a profile Save.
3. Proposed transfer transport: same-origin browser POST to the specialist BFF, strict Origin/CSRF checks, size/count limits, then an opaque one-time reference passed through a fixed-target **form POST**, following P13's browser-bound broker pattern. No payload, JWT, email, private notes or session material in URLs. Opaque references are also kept out of query strings, logs, referrers and analytics.
4. Proposed staging is short-lived (at most 10 minutes, at most 50 selected profiles / 64 KiB), server-side, hashed high-entropy reference, with issuer, expected parent audience, browser challenge and expiry. This guest staging extension is NOT implemented in this ticket. Persistence/permissions must be reviewed before implementation; do not provision a new service or schema silently.
5. Parent account continuation uses a separate bounded server-held context, not a raw payload or reusable Auth code. New registration/verification may outlive a handoff: preserve local data and restart an expired transfer with explicit selection. Existing P13's 90-second authenticated exchange remains short-lived; do not lengthen it to cover email delays.
6. After verified admission, parent prepares a fresh browser-bound authenticated handoff, fixes the account-context reference, and retrieves the selected manifest server-to-server from the authenticated specialist BFF. The user confirms the displayed destination account and selection before mutation. Guest intent alone is not authenticated authority.
7. P13 validates issuer, audience, hub service identity, allowed operation scope, browser state/nonce, expiry, one-time status and current consumer/session context. Consume is atomic in the existing broker transaction; the pure TypeScript predicate is not a substitute for atomic database consumption.
8. Parent resolves exact bindings/publication and executes only selected eligible Saves through owner-authorized P12 operations. No broad parent table credentials are distributed to a specialist. Responses expose bounded result references, not the consumer UUID, email, notes, unrelated Saves or Projects.
9. Parent returns a durable operation receipt with exact identity, account context, request key, Saved reference, and separate Project outcome. The specialist verifies the receipt through its authorized server channel; URL flags and localStorage cannot assert durable parent success.
10. Default is **retain local copies**, including failed/unsupported/unselected/edited/new items. Automatic retirement is permitted only after verified durable receipt AND atomic compare-and-delete of the exact selected item revision/digest in the originating store. All writers must participate (e.g. versioned IndexedDB transaction); localStorage read-modify-write plus a Web Lock used by only one writer is insufficient. V2-2R therefore retains legacy bundles instead of rewriting them.

Ask cannot read a specialist domain's localStorage. This design requires specialist producers and BFF transport; the parent-only code does not complete that transfer. No email-only legacy-account linking. Existing legacy accounts require the reviewed verified-link procedure, and imports remain explicit.

## Minimal parent facade and P12/P13 reuse

These are logical operations, not newly deployed routes. `ParentProfileSavePort` names their typed shape. Runtime implementations must reject extra fields, derive subject from verified parent context, check capability/publication at commit time and apply per-operation authorization/rate limits.

| Operation | Minimum access / result | Existing foundation / work still needed |
| --- | --- | --- |
| Prepare authenticated handoff | Admitted parent session; profile/return-context intent; opaque form POST reference | P13 `ops.create_browser_handoff_intent`, `ops.create_consumer_auth_handoff`; reusable facade/guest continuation extension pending |
| Consume authenticated handoff | Authenticated registered BFF + browser proof + exact audience/session; opaque account-context reference | P13 `ops.consume_consumer_auth_handoff`; atomic expiry/replay controls retained |
| Resolve exact network binding | Hub-scoped public profile lookup only; bounded capability | Existing `network_entity_bindings` and canonical resolution, trusted publication mapping per hub pending |
| Read exact Saved state | Current parent consumer context, exact profile only | Narrow owner-scoped lookup facade; no whole-workspace listing to specialists |
| Save | Scoped `saved:write`, verified consumer, accepted exact binding, idempotency key | P12 `consumer.save_entity`; existing subject/canonical-entity lock and logical dedupe |
| Unsave | Same owner/context; Saved ref resolved server-side; idempotent result | P12 `consumer.remove_saved_entity`; preserve research/export/delete semantics |
| Add/remove Project membership | Same owner of Saved and Project; minimal membership capability | P12 `add_saved_entity_to_project` / `remove_saved_entity_from_project`; do not grant broad Project editing/listing |
| Read operation receipt / return result | Same context/request; exact bounded receipt only | Proposed narrow receipt facade, not handoff-code replay; authorization required on every retry |

The P13 registry already has issuer/audience/BFF identities, origins, allowed return prefixes and scopes for all six hubs in `20260907220000_my_trusthub_cross_hub_handoffs.sql`. Those records are foundation evidence, not proof all integrations are deployed/authorized. New facade scopes should be narrower than the registry's broad existing scope set. Parent broker credentials stay parent-only; use existing service identities only where actually provisioned and approved. Missing credentials/capabilities fail closed, not service-role fallback.

Current Contractor-only routes (`app/my/handoff/{start,prepare,arrive,finish}` and `app/api/my-trusthub/handoff/issue`) illustrate fixed-origin, form-POST, HttpOnly state/nonce cookies. Do not copy their hardcoded origins to other hubs. Their signed-out `continue=save` marker is not a durable resumable context; V2-3 must add the bounded parent-held continuation before claiming a guest-to-account-to-specialist round trip works.

## Idempotency, partial results and ownership

- Logical Save key is `(verified parent subject, resolved canonical network entity)`, reusing P12's existing dedupe. Native identity/binding provenance remains exact. Repeating one request returns the original authorized receipt; another request for the same entity reports `already_saved`, not a second Save.
- Request key binds subject/context and an exact payload fingerprint (identity, selected item revisions, optional Project). Reusing a key with changed payload fails; it does not reuse a mismatched receipt.
- Lost callback/response: query the authorized operation receipt or retry the idempotent Save under a fresh valid context. A consumed handoff code cannot be reused to authenticate.
- Account switching invalidates the old account context. Require a new display/selection confirmation; never silently rebind pending guest data to the new user. Late receipts may update only their matching context and cannot clear another account's local research.
- Project assignment can fail after a durable Save. Report these separately: Saved record remains valid; Project membership is `failed` and retryable through its own idempotent membership operation. Do not retry by creating a new Saved record.
- Batch imports return per-item outcomes. Unknown receipt/transport failure means retain data and do not show parent Saved. If durable Save succeeded but acknowledgment was lost, retry safely.
- Consumer B must not read or mutate Consumer A's exact-state/receipt/Project, even by guessing IDs. Business permissions confer no private access. Deterministic model tests express these requirements; actual RLS/service-credential integration tests remain release gates.

## Return and UI state

Return host is selected from the reviewed per-hub/per-environment registry, never a browser-provided URL. Normalize/decode a path before comparing it with **exact server-generated destinations** for the captured profile/task. Reject external/protocol-relative URLs, backslashes, nested encoding, traversal escapes, auth recursion and arbitrary queries/fragments. Prefix matching alone is insufficient. An expired destination returns to a safe hub landing or parent Saved page with useful recovery copy; it does not discard research. Preview-to-production return/backend pairing is prohibited unless a separately reviewed policy explicitly authorizes that path.

| State | Required wording / trigger |
| --- | --- |
| Anonymous | Save |
| Confirmed local write, including after reload | Saved on this device |
| Optional conversion | Keep this in My TrustHub |
| Verified durable matching parent acknowledgment | Saved to My TrustHub |
| Verified already-Saved parent result | Saved |
| Failure with no durable success | Could not save / Retry |
| Local success but unresolved identity/sync | Saved locally — account sync unavailable |

Accessible name/status must preserve the same distinction as visible copy. Use pending/busy state and an announced retry error; disable duplicate activation only while pending or genuinely saved. A disabled button must not hide the only local/cloud disclosure. No optimistic parent-success label before receipt. Full keyboard and 1440/390/320 checks apply to each adapter.

Compare and Continue hooks carry hub, object kind, schema key where applicable and an opaque context reference. They do not turn a comparison/tool payload into a profile Save.

## Separate research object categories

| Category | Payload ownership / boundary |
| --- | --- |
| PROFILE SAVE | Exact public profile identity/binding; this first-wave contract |
| COMPARISON SESSION | Specialist-owned selected entity set, filters and comparison state |
| CALCULATOR SESSION | Specialist-owned calculator inputs, schema version and results/recompute policy |
| INVENTORY SESSION | Specialist-owned itemized inventory schema; not required to launch profile Save |
| PLAN / WORKSHEET SESSION | Specialist-owned planner/worksheet state and resume schema |

All share parent identity, privacy and optional Project membership. Use P18's approved versioned session schema/resume contracts for tool state; each schema requires its own validation and migration policy. Profile adapters need not wait for Move itemized inventory, and this ticket does not certify real persistence/resume of every tool.

## Test and rollout matrix

`npm run check:my-trusthub-v2-3` exercises deterministic, in-memory specification cases: exact identity, duplicate/retry, conflicting request key, no/one/two Projects, local state, parent continuation, expired/replayed/wrong issuer/audience/hub/browser handoffs, forged consumer fields/business scope, unresolved/unpublished/unsupported class, Watch-unavailable NJ Save, zero Watch/Alert/ranking effects, account switch, normalized malicious returns and partial Project failure. No test contacts a production service or proves live RLS.

| Specialist | Legacy repair handoff | Adapter/identity mapping | Independent status |
| --- | --- | --- | --- |
| Move | PR #156, `db6d640398ee622d0c3153e968ce14d621ec744a` | Native company slug; reviewed parent mapping still required | Local fixture checks executed; reload local-copy disclosure defect returned to Builder 3 |
| Insurance | PR #55, `426ad49b91d0fdc65b54e4ce515c45c7732910a5`, arrived during this run | Handoff/file inventory reviewed; do not guess agency/person/insurer binding | PENDING INDEPENDENT RUNTIME QA; Builder 3 report not certification |
| Lender | PR #52, `315093be109796c9dd170e80a936ecd10e9cff7d`, arrived during this run | Handoff/file inventory reviewed; no localhost repair/config changes | PENDING INDEPENDENT RUNTIME QA; Builder 3 report not certification |
| Contractor | Existing P13 proof is not generic six-hub completion | Reuse approved exact identity/broker contract; separate incident out of scope | Adapter not implemented here |
| Senior | Prior local Save report is not parent-sync evidence | Existing published class mapping required | Adapter not implemented here |
| Investor | No new implementation under this ticket | Existing published class mapping required | Adapter not implemented here |

Before adapter implementation: coordinator accepts this contract, each hub supplies exact publication/native-class/binding mapping and immutable preview, and an authorized isolated parent/BFF/database/inbox path exists. Then implement one scoped adapter with owner/RLS/idempotency/replay/browser tests, review, and separately approve release. Do not deploy six speculative endpoints or enable signup under this contract-preparation ticket.
