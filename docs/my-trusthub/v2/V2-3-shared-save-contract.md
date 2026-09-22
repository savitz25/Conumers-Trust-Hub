# V2-3 shared specialist profile Save contract

Version: V2-3C closure, `v2-3/selected-profiles/2`. Updated 2026-09-19 by Builder 4. Original `profile-save/1` tests remain historical invariant examples, not the complete adapter wire format.

Status: READY FOR RUNTIME IMPLEMENTATION of the reviewed shared contract, not authorization to deploy or enable adapters. No specialist adapters/endpoints, migrations, permissions, credentials or production changes deployed. The complete typed port is `lib/my-trusthub/contracts/v2-3-profile-transfer.ts`, inherited by `ParentProfileSavePort`; `v2-3-profile-transfer.model.ts` is a deterministic in-memory reference model only. Existing `v2-3-profile-save.ts` predicates/tests are retained. This is not a replacement identity system or a live API implementation. The V2-3C section below controls where it refines the original proposal.

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
10. First-release rule is **KEEP LOCAL COPY**, including successful/failed/unsupported/unselected/edited/new items. There is NO retirement operation in V2-3C. Successful parent acknowledgment may update account-confirmed UI while retaining local research. Atomic retirement, if ever wanted, requires a separately versioned protocol in which every writer participates; localStorage read-modify-write plus one writer's Web Lock is insufficient.

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
| Move | PR #156, `35a83ca97f98fb5ee46bb849569808fd5e962a90` | Local slug is NOT implicitly parent native ID; exact `Company.id` binding mapping below | QA-M9 closed by independent exact-head re-QA; real provider NOT RUN |
| Insurance | PR #55, `426ad49b91d0fdc65b54e4ce515c45c7732910a5` | Mapper rules below; agency/person/insurer kept distinct | Independent local QA FAIL B4-I1, reload device disclosure; returned to Builder 3 |
| Lender | PR #52, `315093be109796c9dd170e80a936ecd10e9cff7d` | Mapper rules below; no localhost repair/config changes | Independent local QA FAIL B4-L1 reload disclosure / B4-L2 stale push acknowledgment; returned to Builder 3 |
| Contractor | Existing P13 proof is not generic six-hub completion | Reuse approved exact identity/broker contract; separate incident out of scope | Adapter not implemented here |
| Senior | Prior local Save report is not parent-sync evidence | Existing published class mapping required | Adapter not implemented here |
| Investor | No new implementation under this ticket | Existing published class mapping required | Adapter not implemented here |

Before adapter implementation: coordinator accepts this contract, each hub supplies exact publication/native-class/binding mapping and immutable preview, and an authorized isolated parent/BFF/database/inbox path exists. Then implement one scoped adapter with owner/RLS/idempotency/replay/browser tests, review, and separately approve release. Do not deploy six speculative endpoints or enable signup under this contract-preparation ticket.

## V2-3C: closed specialist review findings

| Finding | Disposition | Contract change / test | Runtime migration required? | Blocks adapter coding? |
| --- | --- | --- | --- | --- |
| Insurance `/providers/{slug}` not covered by old P13 registry | Accepted | Exact typed profile destination constructor + environment registry; C01–C03. Separate metadata/broker proposal in `V2-3C-unapplied-registry-proposal.md`; old broad-prefix route is NOT opened. | Y, UNAPPLIED; atomic broker implementation remains a release prerequisite | N for isolated implementation; Y for runtime enablement until proposal is implemented/tested |
| Missing staging/continuation/receipt methods | Accepted | Six named operations below, strict input validation C04–C10, atomic-consumption reference model | Persistent staging/continuation/receipt implementation must reuse/extend P13 in a separately reviewed migration package; no new grant implied | N; implementation obligations explicit |
| Slug/native/class and manifest/Project binding unclear | Accepted and clarified | Mapping rules below, versioned SHA-256 fingerprint, item + Project bound receipt; C05/C06/C09–C14 | No identity/data rewrite; unresolved binding stays local | N; a record without a reviewed mapping cannot be enabled for parent Save |

No finding is silently rejected. Insurance/Lender legacy QA findings remain open independently of this protocol closure.

### Three identities, exact mapping rules

1. `localItemId` identifies a record in the specialist browser store. Move derives it from the existing exact local `companySlug` namespace; Insurance/Lender use their existing saved item `id`. It is never a parent entity ID.
2. `{hub,nativeId,profileClass}` is a trusted specialist identity. IDs preserve case/namespace. Slug may be native ID ONLY in an explicitly reviewed adapter mapping, never by network-wide convention.
3. Parent `networkEntityId` is resolved from reviewed binding records by the parent, never accepted from request JSON. A business claim token or legacy Auth subject is not consumer authority.

| Surface | Required trusted mapper | Existing class / handling |
| --- | --- | --- |
| Move local `companySlug` | Resolve canonical public `Company` using existing resolver/alias policy → `Company.id` → exact reviewed parent binding; retain captured slug as return context | Existing binding class `mover`, not invented `moving_company` taxonomy. Capabilities/roles are not identity classes. State-only/NJ without binding remains local; no USDOT/Florida/Watch gate for basic local Save. |
| Insurance `providerSlug` | Resolve public Provider through current provenance/trust-state gate → `Provider.id`; require a reviewed exact map to the appropriate specialist native entity and class | Provider type does not prove person versus agency. Missing reviewed discriminator/binding yields `local_only` or `identity_review_required`; never guess from name, license text or LOA. `agency` test fixture represents an already-reviewed agency mapping, not a blanket provider classification. |
| Insurance legal insurer | Separate `/insurers` producer is NOT included in first-wave provider adapter. Future explicit mapper uses published `entity_id` + existing `legal_insurer` class | Never reuse agency mapping, NPN or provider slug as NAIC/legal-insurer identity. No `/insurers` return capability added here. |
| Lender local `lenderSlug` | Resolve exact public catalog profile, then reviewed map to published institution `institution_id` / `nmls-inst:*` binding, preserving original route context | Existing bound class `institution`; legacy catalog ID, branch variation, NMLS string or display type alone cannot supply the institution UUID. Missing mapping stays local. |

These mappers must recheck publication at commit, using the appropriate surface's gate. SEO noindex does not itself mean unpublished. They MUST NOT use name/email/display-name/geography similarity or modify regulatory/entity data. `TrustedMapper` and `TrustedCommitAdapter.resolveCurrent` are explicit server-only ports; pure types do not make browser data trusted. Record-specific mapping fixtures are required in each adapter PR. This resolves the mapping rule without inventing nonexistent accepted bindings.

### Complete operation boundary

All input objects reject extra/missing fields, including consumer IDs, emails, roles, notes, token payloads, binding IDs and success booleans. Six first-release port methods:

| Method | Caller / binding / result |
| --- | --- |
| `prepareGuestProfileTransfer` | Specialist same-origin BFF validates Origin/CSRF, obtains exact local selection and trusted profile mapper, sets source hub/audience and server-generated return task. At most 50 items / 64 KiB / 10 minutes. Returns opaque transfer ref + manifest digest + expiry. Browser binding is derived by BFF cookie/challenge, not request JSON. |
| `prepareProfileSaveContinuation` | Authorized source BFF presents transfer ref/digest to parent-held continuation service; fixed audience Ask, matching hub/browser/environment. Returns expiring opaque continuation ref. No consumer yet; no account mutation. |
| `consumeProfileSaveContinuation` | After verified/admitted parent session and explicit displayed account/selection confirmation, validate issuer/audience/browser proof and atomically consume once. Bind transfer/digest to a parent-issued current account context. Mint a fresh 90-second authenticated P13 exchange only now. |
| `commitProfileSave` | Exact captured selected item, transfer/manifest digest, idempotency key and current account context; trusted current binding/publication lookup; optional parent-owned Project reference. Returns per-item parent and Project outcome separately. No direct table access. |
| `getProfileSaveReceipt` | Reauthenticate current parent account context for exact request key; returns only that authorized receipt or null. Lost-response lookup does not reuse consumed handoff and does not require unexpired guest staging. A new login can obtain a fresh narrowly scoped grant to the same operation only after parent verifies same subject/browser intent; never silently carry it into a different account. |
| `verifyProfileSaveReceipt` | Authorized same-hub BFF calls parent over authenticated server channel with exact receipt/request/context/manifest/item/Project references. Parent loads authoritative stored receipt. No browser-supplied parent-success payload is accepted. Return contains no email, UUID, unrelated Saves or Project notes. |

Transport remains fixed-target browser-bound form POST, with HttpOnly challenge/state cookies and appropriate CSP/no-store/no-referrer. Browser receives no service credential. Specialist BFF and parent authenticate each other using existing approved identities; absence fails closed. No new scope is activated here. Stage refs are CSPRNG opaque values stored hashed at rest; raw refs never enter URLs/logs/analytics. The deterministic model's counter refs are TEST ONLY.

The source specialist owns staged profile-only manifest storage; parent owns continuation/account context and durable receipt storage. Staging is not authority to Save. Parent fetches the manifest via the authorized source BFF, confirms selection, then commits through P12. Database/runtime authors must supply atomic consume, uniqueness/idempotency transactions, RLS, current-session validation and bounded retention/rate limits. Local Maps are not that implementation. An email journey exceeding staging lifetime restarts from retained local selection; no extension of P13's 90-second exchange.

### Digest, receipt and Project rules

Each selected item carries exact local ID, captured revision, SHA-256 digest and specialist tuple. Adapter-generated revision/digest describes the captured profile-only projection, not private notes/tool payload. Without a revision writer, snapshot a versioned digest of the exact allowed projection and use that digest as revision; this is evidence binding, NOT permission to delete the local record. Keep all local data.

Manifest digest algorithm is `manifestDigest` in the executable spec: SHA-256 over UTF-8 JSON positional array `[version,sourceHub,audience,selected item arrays,return-task array]`. Selection order is significant; object property insertion order is not. Exact captured revision/digest and trusted return identity are included. Idempotency key binds verified subject/context + transfer ref + manifest digest + exact item projection + optional Project ref. Changing any of these under the same key fails.

Receipt parent outcomes: `saved`, `already_saved`, `local_only`, `identity_review_required`, `profile_not_published`, `unsupported_class`, `failed`. Only `saved`/`already_saved` carry an authorized parent Saved reference. Project outcomes: `not_requested`, `added`, `already_member`, `failed`, with only the exact requested opaque Project reference. Parent Save success survives Project failure. Retry Project under its own operation key, referencing the same logical Save; duplicate Save still resolves `already_saved`. No Project is required, and zero Watches/Alerts/ranking/provider disclosure follows.

Receipt binds request key, account context, manifest digest, exact selected local ID/revision/digest/tuple, parent Saved ref when authorized, and separate Project result. Transport/provider failure without authoritative receipt is unknown, NOT saved/zero-result proof; retain local copy and retry/lookup. All receipt results set `localCopy:'keep'`. Forged completion query, stale item digest, wrong Project, wrong BFF or another consumer cannot acknowledge this selection. Account switching invalidates current context; require a new confirmation.

UI can show parent acknowledgment while retaining device data. Legacy Move/Insurance/Lender account success remains labeled as its own workspace, never parent My TrustHub. Compare/Continue hooks and calculator/comparison/inventory/plan schemas remain separate, as above. No runtime adapter or transfer endpoint is deployed by V2-3C.
