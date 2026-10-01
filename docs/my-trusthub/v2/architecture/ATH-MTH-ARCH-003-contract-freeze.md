# ATH-MTH-ARCH-003 — My TrustHub V2 implementation contract

Status: documentation only. This file is the normative contract for every remaining My TrustHub V2 builder ticket, including ATH-MTH-ARCH-004 and later six-hub rollout work.

ATH-MTH-ARCH-003R1 corrects the hosted confirmation-label description and the pre-ARCH-004 delta register after the independent hold. The sections that already passed review are unchanged in substance.

This path is the architecture series opened by [ATH-MTH-ARCH-001](ATH-MTH-ARCH-001-identity-environment-map.md). No separate index lists these documents. This ticket adds only this file.

Governing decision, founder-adopted, not reopened here:

ONE IDENTITY. SPECIALIST TOOLS. PARENT SAVED/PROJECTS. SAVE ≠ WATCH.

The AD-0 addendum pointer is the diagram in ARCH-001 section 14. Its conceptual fields are frozen below as normative names. They are not current SQL column names.

## How to read this contract

Each rule is marked with one of these labels:

- **FROZEN CONTRACT** — the behavior later tickets MUST implement and reviewers MUST use as the pass bar.
- **CURRENT IMPLEMENTATION** — what the inspected commits actually do. A difference from the frozen contract is a delta. This ticket does not repair it.
- **FUTURE MIGRATION** — required before mass migration or production header cutover, and not required to start the first public-profile receipt proof unless a delta says otherwise.
- **UNKNOWN** — not proven by the files read for this ticket. Later tickets MUST NOT treat an unknown as a fact.

Normative words MUST, MUST NOT, SHALL, SHALL NOT, and MAY have their usual standards meaning.

## 0. Pins

| Item | Value |
| --- | --- |
| Ask repository | `savitz25/Conumers-Trust-Hub` |
| Ticket 2 certified head | `abf9935ab605969b0a72016ece8e580ee9f454a8` |
| Ticket 2 merge / starting `main` | `f5e09d43028c067e319bc709216af5ba435d9b28` |
| This branch | `ath-mth-arch-003-contract-freeze`, taken from that merge |
| Ask PR #185 | OPEN, DRAFT, UNMERGED. Branch `mth-v2-3-parent-runtime`. Head `b885a651d1b229f8c6acbc5888733af08f4a5e5d`. Not modified. |
| Move PR #169 | OPEN, not a draft, UNMERGED. Branch `mth-v2-3-move-current-main`. Head `73bc86e503a57fc52d420a1c339c7fd8b912e2af`. Not modified. |
| ATH-MTH-ARCH-001 | CERTIFIED. Map remains `docs/my-trusthub/v2/architecture/ATH-MTH-ARCH-001-identity-environment-map.md`. |
| ATH-MTH-ARCH-002 | CERTIFIED CLOSED. Receipt remains `docs/my-trusthub/v2/qa/ATH-MTH-ARCH-002-user-a-auth-autopsy.md`. |
| USER_A auth | PASS on the reviewed Ask preview. This does not prove a profile Save, a parent receipt, or `/my/saved`. |
| P13 | NOT EXECUTED by ARCH-002 and NOT EXECUTED by this ticket. |

Merged `main` contains the P11–P19 migrations and the ARCH-001 / ARCH-002 documents. It does not contain `lib/my-trusthub/profile-save/`. The V2-3 profile-save runtime and `supabase/migrations/20260919205200_my_trusthub_v23_transaction_capability.sql` exist only on unmerged PR #185. The Move specialist adapter exists only on unmerged PR #169.

## 1. Identity

### FROZEN CONTRACT

Ask SHALL be the long-term canonical consumer identity owner.

Production consumer authority SHALL be Supabase project `qvvxvbcdmbjzrgvwjatw`. Isolated Ask QA SHALL be `xkkiicsassizmakcvxml`. Legacy specialist projects remain separate migration concerns. The certified project list in ARCH-001 section 1 is authoritative. This contract does not reopen it.

**Canonical consumer subject** means the Ask-admitted `auth.users` subject that owns that person's `/my` private workspace. Admission is an Ask server decision. A specialist MUST NOT choose, mint, or accept a browser-supplied value as that subject. A Generation 1 consumer UUID MUST NOT be copied into it.

Browser handoff MUST NOT carry the Ask consumer UUID or the consumer email. Email equality SHALL NOT be treated as identity proof. Linking a legacy subject to the canonical consumer subject MUST use an explicit verified proof.

`/my` private consumer data and `/manage` business data MUST remain logically separate even when one human later uses one Ask identity for both.

### CURRENT IMPLEMENTATION

On merged P11, `consumer.require_user()` returns `auth.uid()` and raises `insufficient_privilege` when that value is null. `consumer.consumer_profiles.user_id` references `auth.users(id)`. The table comment calls this the private My TrustHub root and says business roles grant no access.

`ops.consumer_identity_links` stores an explicit map: `canonical_user_id`, `legacy_hub`, `legacy_subject_namespace`, `legacy_subject_id`, `link_status` (`linked` or `revoked`), and `verification_method` (`signed_handoff`, `reauthenticated_legacy_session`, `admin_review`, or `migration_batch`). The table comment prohibits email-only matching. The legacy id is not copied into `consumer.user_id`.

PR #185 `VerifiedCaller.parent.subject` is supplied by the auth adapter. The profile-save comment forbids constructing that caller from JSON, headers, or URL claims. `ParentProfileSavePort` and the transfer port comments say no operation accepts a consumer UUID or email. Move `profile-save-adapter.ts` derives the parent through the verified channel.

The specialist browser handoff and the hosted Ask confirmation page are different surfaces.

The handoff form posts only the opaque `continuationRef`. That payload MUST NOT carry the Ask consumer UUID or the consumer email.

After that continuation reaches Ask, the hosted confirmation path resolves the parent with `verifiedParent` in `lib/my-trusthub/profile-save/verified-parent.ts`. `verifiedParent` sets `label` from the admitted account: `u.email`, or the fallback text `Your My TrustHub account` when that email is absent. `lib/my-trusthub/profile-save/browser.ts` prints that label on `/my/profile-save` as `Destination:` before Confirm Save. The page MAY therefore show the authenticated account email. Ask reads that email from the admitted session. The specialist handoff does not carry it.

`preview-assembly.ts` stores a separate internal exchange whose `label` is an empty string. That empty string is not the hosted confirmation label.

The same confirmation page also renders each selected `profile.hub` and `profile.nativeId`. That native id is the specialist public identity.

### FUTURE MIGRATION

Production sessions on `qvvxvbcdmbjzrgvwjatw` become the only network consumer subject after the cutover gates in section 21. Until then, Generation 1 subjects stay on their current projects and are not bulk-linked.

### UNKNOWN

Whether `consumer.consumer_profiles` and `ops.consumer_identity_links` are applied on `qvvxvbcdmbjzrgvwjatw` or on `xkkiicsassizmakcvxml` was not re-queried. ARCH-001 recorded an earlier read-only view of the `consumer` schema on the QA project. This ticket does not treat that earlier view as a fresh proof.

The claim user store behind `/manage` remains the ARCH-001 unknown. Business data selection remains Neon (`neon_tech_database`, then `ASK_DATABASE_URL`), not the consumer Auth project.

## 2. Ownership

### FROZEN CONTRACT

Ask MUST own:

- consumer identity
- admission
- the account Saved registry
- Projects
- Project membership
- private project notes where the product has them
- parent Save receipts
- the Watch registry
- export orchestration
- deletion orchestration
- network-level continuation authorization

A specialist MUST own:

- public evidence
- regulatory and source records
- specialist entity identity
- specialist profiles
- guest and device state
- the vertical tool runtime
- the private vertical tool payload
- source revisions
- calculation and report generation

Ask MUST NOT become the moving-inventory engine, the insurance drug-basket engine, the lender scenario or calculator engine, or a specialist report-generation engine.

A specialist MUST NOT become the network source of truth for consumer `auth.users` identity, parent Projects, parent account Saved authority, email-only identity merge, Save-created Watch, or a browser-selected Ask UUID.

### CURRENT IMPLEMENTATION

P11 `network.network_entities` is a thin registry (`id`, `entity_type`, `canonical_name`, `primary_hub`, `jurisdiction`, `canonical_public_profile_ref`, `status`). Its comment says it is not ranking, Trust Score, or copied regulator evidence. `network.network_entity_bindings` holds `hub`, `specialist_entity_type`, `specialist_entity_id`, and binding status. The unique current specialist index is `(hub, specialist_entity_type, specialist_entity_id)` where `binding_status = 'accepted'` and `valid_to` is null.

P12 owns `consumer.consumer_saved_entities`, `consumer.consumer_projects`, `consumer.consumer_project_saved_entities`, guest import tables, and private notes. The P12 migration header says it creates no Watch, Alert, observation, session, decision, delivery, or export objects.

Watch rows live in `consumer.consumer_watches`, created by the later watch migration, and are started through `consumer.start_watch`. Export and deletion metadata live in the P19 migration (`ops.consumer_export_jobs`, `ops.consumer_deletion_jobs`, and the related decision and snapshot tables). The P19 header says the migration is validation-only until separately approved.

Move at PR #169 keeps the local shortlist and refuses `commitProfileSave` and `consumeProfileSaveContinuation` on the specialist channel.

## 3. Two types of saved object

### FROZEN CONTRACT

The network has two saved-object types.

**Public entity Save.** Example: a mover profile. Ask stores a Saved pointer to one exact specialist public identity. Ask does not copy the public evidence body into the consumer row.

**Private tool object.** Examples: an itemized Move inventory, a Move plan, an insurance drug basket, an insurance research session, a lender estimate or scenario, and a lender plan. Ask MUST NOT store the live working runtime as its authoritative engine.

The durable private chain MUST be:

Ask consumer → Ask Saved, and an optional Project → opaque specialist object reference → specialist private tool object.

### CURRENT IMPLEMENTATION

The reviewed profile-save path is a public entity Save. `ResearchKind` in `lib/my-trusthub/contracts/v2-3-profile-save.ts` names `profile`, `comparison`, `calculator`, `inventory`, `plan`, and `worksheet`, but the executable transfer runtime stages a profile selection (`GuestStageInput`) and commits `consumer.save_entity` for an accepted binding. It does not persist an inventory, basket, or scenario body.

Move Generation 1 tables `public.saved_inventories`, `public.saved_movers`, and `public.saved_move_plans` remain on the Move specialist database. They are not the Ask Saved registry.

### FUTURE MIGRATION

Private tool objects stay on the specialist until the opaque-reference chain in section 4 is implemented and proven. Mass migration of inventories, baskets, and scenarios MUST NOT start before that proof.

## 4. Opaque specialist object

### FROZEN CONTRACT

The conceptual pointer fields, taken from the AD-0 addendum diagram, are:

- `hub`
- `object_class`
- `schema_version`
- `opaque_object_id`
- `source_revision`
- `receipt_id`

These are normative names. They are not a claim that SQL columns with these names exist.

A private specialist object MUST be keyed by `opaque_object_id`. It MUST NOT be keyed by `auth.users.id` and MUST NOT be keyed by a Generation 1 consumer UUID.

Ask MAY later retain an encrypted backup or snapshot of a private object for export or disaster recovery. That backup MUST NOT be the live working set.

### CURRENT IMPLEMENTATION

No inspected table defines columns named `object_class`, `schema_version`, `opaque_object_id`, `source_revision`, or `receipt_id`.

Closest current fields for a **public entity Save**:

| Normative name | Current field |
| --- | --- |
| `hub` | `network.network_entity_bindings.hub` and `consumer.consumer_saved_entities.source_hub`. Transfer identity uses `profile.hub`. |
| `object_class` | `specialist_entity_type` on the binding, and `profile.profileClass` on the transfer item. Approved class for Move is `mover`. |
| `schema_version` | Transfer wire `TRANSFER_VERSION` is `v2-3/selected-profiles/2`. Move stages `TRANSFER_VERSION_V3` (`v2-3/selected-profiles/3`). Location context inside P12 allows `schema_version` only as a location-context key, default `'1'`. |
| `opaque_object_id` | Not implemented for a private tool. Public Save uses `network_entity_id` and `source_binding_id`. `ContinueHook.opaqueContextRef` is a type field only. |
| `source_revision` | Transfer `SelectedItem.revision` and `SelectedItem.digest`. Move sets `revision` to the SHA-256 hex of `projection(companySlug, savedAt)`. There is no `source_revision` column on `consumer_saved_entities`. |
| `receipt_id` | `ItemReceipt.receiptRef`, an opaque 43-character token. The durable row is `ops.v23_profile_runtime_records` with `kind = 'receipt'` and `key_hash`. P13 `code_hash` is a handoff secret hash, not this receipt. |

`consumer.save_entity` writes the canonical network entity id and the binding id. It does not write a private tool payload.

### FUTURE MIGRATION

A private tool reference MUST carry the six normative fields above, with `opaque_object_id` minted by the specialist. Ask Saved stores the pointer. The specialist remains the live store.

### UNKNOWN

No encrypted consumer backup column was found in the migrations read for this ticket. Absence from those files is not proof that no backup exists in an unread path.

## 5. Continue

### FROZEN CONTRACT

Future Continue for a private tool object MUST work as follows.

1. Ask resolves the authenticated consumer on the server.
2. Ask resolves Saved or Project membership on the server.
3. Ask mints a short-lived capability.
4. That capability MUST be single-use, hub-bound, object-bound, origin-bound where a browser origin is involved, expiration-bound, and replay-resistant.

The browser MUST carry only the opaque capability. The browser MUST NOT carry the Ask UUID, the consumer email, or a service credential.

The specialist MUST redeem the capability on the server or through its BFF and MUST rehydrate the tool from its private object.

ATH-MTH-ARCH-004 MUST NOT be blocked on this private-tool Continue contract. The first Move proof is a public entity Save: a mover profile. The reviewed runtime returns the consumer to the public profile URL. It does not rehydrate an inventory or plan.

Mass migration of inventories, baskets, and scenarios MUST NOT proceed until private-tool Continue is implemented and proven. That proof is a later ticket.

### CURRENT IMPLEMENTATION

Public-profile return is implemented as `profileReturnDestination`: the trusted specialist origin plus the canonical profile path. For the Move V3 stage that path is `/companies/{canonicalSlug}`.

`ContinueHook` (`kind`, `hub`, optional `schemaKey`, optional `opaqueContextRef`) exists on the unmerged profile-save contract. The same file's `ParentProfileSavePort` comment says that facade is not implemented or exposed. The executable parent path is `ParentProfileSaveRuntime.commitProfileSave`, which saves a public binding and does not read a private tool object.

Staging and grant lifetimes in the transfer runtime use `STAGING_TTL_MS` (600000). That is the public-profile transfer window, not a private-tool capability.

## 6. Guest and device state

### FROZEN CONTRACT

Public research MUST be usable without a login.

Guest or device Save MUST be allowed. Guest specialist state MUST remain local until the consumer crosses this boundary:

device Save → the user selects Keep in My TrustHub → Ask authenticated session → explicit confirmation → parent commit → parent receipt.

Until a parent receipt exists, a device Save MUST NOT be reported as account Save success.

If the parent Save fails, the device copy MUST survive. The system MUST NOT silently delete it and MUST NOT silently merge it into an account row.

### CURRENT IMPLEMENTATION

`SaveMoverButton` writes the local shortlist before any cloud call. Cloud failure still tells the user the company was saved on this device. The Keep control renders only when that local row exists and `NEXT_PUBLIC_MOVE_PARENT_SAVE_ENABLED` is exactly `1`.

Move adapter results that stop before a parent receipt use `localCopy: 'keep'`. The Ask confirmation page says the device copy is unchanged when Save is unavailable, and that the device copy is retained after a parent outcome.

P12 also has `consumer.consumer_guest_imports`, unique on `(user_id, idempotency_key)`, and `consumer.commit_guest_import`, which calls `consumer.save_entity`. That path is the merged guest-import RPC. The reviewed Move profile journey uses the local shortlist and the V2-3 transfer, not this guest-import RPC.

## 7. Account Save semantics

### FROZEN CONTRACT

A successful My TrustHub account Save MUST have all of the following:

- an authenticated, admitted Ask consumer
- the exact specialist identity
- explicit user confirmation
- an accepted continuation
- a parent commit
- a parent receipt

The words below are the frozen meanings. Where the runtime already has a name, that name is the one ARCH-004 MUST record. This contract does not add a new status enum.

| Frozen meaning | Current name to record |
| --- | --- |
| SUCCESS | Parent `outcome` `saved` with a `savedRef`, or confirmation text "Saved to My TrustHub" when every item is `saved` or `already_saved`. Move adapter state `parent_saved` after a verified receipt. `localCopy` remains `keep`. |
| LOCAL_ONLY | Adapter state `local_only`, or parent `outcome` `local_only`, `identity_review_required`, `profile_not_published`, or `unsupported_class`. UI copy "Saved on this device". This is not account success. |
| RETRYABLE_FAILURE | `RuntimeError` code `unavailable` (confirmation HTTP 503, "Save is unavailable", device copy unchanged) and `rate_limited`. The transfer `SaveResult` failed reason `unavailable` carries `retryable: true`. A retry MUST be a new explicit attempt. It MUST NOT replay a consumed continuation. |
| REJECTED / INVALID_HANDOFF | `RuntimeError` `invalid`, `unauthorized`, or `conflict`. Adapter states `invalid`, `expired`, and `account_changed`. Confirmation HTTP 400, 409, and 410. |
| ALREADY_SAVED / IDEMPOTENT_SUCCESS | Parent `outcome` `already_saved` when `consumer.save_entity` returns `created = false` and `restored = false`. The confirmation page treats `already_saved` as account success. The Saved row count MUST stay one. |

`saved.restored = true` is a restore of a soft-removed row. The runtime labels that parent outcome `saved`, not `already_saved`.

### CURRENT IMPLEMENTATION

`ParentSaveOutcome` is `saved`, `already_saved`, `local_only`, `identity_review_required`, `profile_not_published`, `unsupported_class`, or `failed`.

`commitProfileSave` calls `saveP12` only when `profileCapability` is `SAVE_SUPPORTED` and a binding is present. Otherwise it stores a receipt whose parent outcome is the non-durable capability name and does not write a Saved row. A receipt with `local_only` is not account Save success under the frozen rule above. ARCH-004 success requires `saved` or `already_saved` plus a `savedRef`.

Move `finish` does not commit. It reads `getProfileSaveReceipt` and `verifyProfileSaveReceipt`. The parent commit runs in Ask `handleProfileConfirmation` after the consumer posts `confirm=yes`.

`SAVE_LABELS` on the shared contract are: anonymous "Save", `local_saved` "Saved on this device", conversion "Keep this in My TrustHub", `parent_saved` "Saved to My TrustHub", `already_saved` "Saved", failure "Could not save / Retry", and `identity_unresolved` "Saved locally — account sync unavailable".

## 8. Idempotency

### FROZEN CONTRACT

A repeated account Save of the same exact specialist entity for the same canonical consumer subject MUST NOT create a second active account row.

### CURRENT IMPLEMENTATION

`consumer.consumer_saved_entities` has `unique (user_id, network_entity_id)`. `removed_at` is not part of that key. Soft-removed rows still occupy it.

`consumer.save_entity(p_binding_id, p_source_hub, p_source_context)` locks on `auth.uid()` plus the canonical entity from `network.resolve_canonical_entity`. If a row for that subject and canonical entity exists, the function clears `removed_at`, updates the binding and source fields, and returns the same `saved_entity_id`. `created` is false. `restored` is true only when the previous row had `removed_at` set. A new row is inserted only when no row exists for that pair.

The V2-3 receipt idempotency key is separate. `receiptKey` is the SHA-256 of the parent subject, `accountContextRef`, and `requestKey`. The same key and the same fingerprint return the stored receipt. A different fingerprint on that key raises `conflict`. A new `requestKey` for the same entity calls `save_entity` again and MUST still resolve to the same Saved row.

Move builds `requestKey` as `requestPrefix || ':' || index` stored with the transfer ticket.

This public-entity dedup is sufficient for the first profile proof. No second unique key is invented here.

## 9. Receipt

### FROZEN CONTRACT

Account Save success MUST produce a parent receipt. The server-side receipt MUST be sufficient to show:

- the accepted operation
- the authenticated consumer
- the specialist source
- the exact entity or object
- the completion result
- the schema or source revision where the transfer has one

The browser-visible receipt reference MUST NOT expose the consumer UUID, the consumer email, a raw continuation secret, or a service credential. A public specialist identity MAY appear on the signed-in confirmation page. The `Destination:` label in section 1 comes from the admitted session and may be the account email. That label is separate from the receipt reference.

### CURRENT IMPLEMENTATION

The unmerged receipt row is `ops.v23_profile_runtime_records` with `kind` in `stage`, `continuation`, `grant`, or `receipt`. Columns include `key_hash`, `payload`, `created_at`, `hub`, `browser_hash`, and `owner_id`. Receipt checks require `key_hash` to match the authority `receiptKey`, and the payload item, `requestKey`, `accountContextRef`, `manifestDigest`, and project ref to match the authority input. Outcomes `saved` and `already_saved` must match `v23_private.save_validation.saved_id`.

`ItemReceipt` fields are `receiptRef`, `requestKey`, `accountContextRef`, `manifestDigest`, `item`, `parent.outcome`, `parent.savedRef`, `project.outcome`, and `localCopy: 'keep'`.

The confirmation success page does not print `receiptRef`. It links to `/my/saved` and, when the return destination validates, back to the Move profile. It states that Save does not start a Watch.

P13 tables are a different object: `ops.consumer_browser_handoff_intents`, `ops.consumer_auth_handoffs`, `ops.consumer_context_handoffs`, and `ops.consumer_handoff_events`. They store SHA-256 hashes. Their comments say raw codes, JWTs, refresh tokens, and canonical ids do not enter browser URLs.

The v23 migration file header still says the migration is unapplied to hosted environments. G-B2 independently confirmed, by a read-only inspection of `xkkiicsassizmakcvxml`, that `ops.v23_profile_runtime_records` is present. The observed columns include `kind`, `key_hash`, `payload`, `created_at`, `hub`, `browser_hash`, and `owner_id`. `kind` allows `stage`, `continuation`, `grant`, and `receipt`. Those fields are structurally compatible with the reviewed runtime. Private row contents are not recorded here. This correction did not re-query the database.

Cleanup in that migration deletes receipt rows older than 30 days and other runtime rows older than one hour, measured from `created_at`. `RECEIPT_RETENTION_MS` in the runtime is the same 30 days. Retention is not the handoff TTL.

## 10. Specialist to Ask handoff

### FROZEN CONTRACT

The public-profile journey MUST be:

specialist profile → device Save → Keep in My TrustHub → opaque handoff → Ask session → explicit confirmation → parent Save → receipt → `/my/saved`.

The specialist MUST resolve its own source identity. Ask MUST derive the consumer subject from the admitted session. The specialist MUST NOT commit the account Save. The specialist MUST NOT send the consumer UUID or the consumer email through the browser handoff.

Handoff protection MUST include a bounded TTL, single use, origin binding, a CSRF or nonce check, `no-store`, and redaction of secrets. The numbers below are the implemented values. This ticket does not pick a replacement number.

### CURRENT IMPLEMENTATION

Move `KeepInMyTrustHub` posts `action: 'prepare'` to the same-origin `/api/my-trusthub/profile-save` with `cache: 'no-store'` and header `X-MTH-CSRF` taken from a bootstrap response. On `state: 'continue'` it stores only a 43-character ticket in `sessionStorage` and posts `continuationRef` to the Ask form. The browser URL is not given a completion flag.

Ask `POST /my/profile-save` accepts that single field, checks the `Origin` against the source hub's trusted origin, stores a server confirmation, and sets an `HttpOnly` cookie `mth_parent_profile_confirmation` with `SameSite=Lax`, `Max-Age=600`, and `Secure` on HTTPS. The following page requires a signed-in parent. The commit form requires `csrf` to match the stored token and `confirm=yes`. The visible commitment text is "Save these selected profiles to this account". The button is "Confirm Save".

`consumeProfileSaveContinuation` marks the continuation `used: true`. A second consume raises `conflict`. The grant is bound to the parent subject, the session hash, the browser hash, and the hub. `commitProfileSave` requires that grant and the staged manifest.

Implemented time bounds, which are not one TTL:

| Bound | Current value | Where |
| --- | --- | --- |
| P13 column maximum | `expires_at <= created_at + 120 seconds` | `ops.consumer_browser_handoff_intents`, `ops.consumer_auth_handoffs`, `ops.consumer_context_handoffs` |
| P13 context issue | `statement_timestamp() + 90 seconds` | context handoff insert in the P13 migration |
| Exchange matcher | `EXCHANGE_TTL_MS = 90000` | `v2-3-profile-transfer.ts` |
| Preview exchange record | `Date.now() + 85000` | `preview-assembly.ts` |
| Current-grant challenge | `Date.now() + 90000` | `current-grant.ts` |
| Stage, continuation, grant, confirmation cookie | `STAGING_TTL_MS = 600000` | transfer runtime and confirmation cookie |
| Receipt recovery | 5 minutes from `verifiedAt` | `runtime.ts` `receiptRecovery` |
| Transaction authority visibility | 30 seconds | `v23_private.transaction_authority` policy |

`Cache-Control` on the profile-save HTTP helper is `private, no-store, max-age=0`. P13 stores `nonce_hash` and `browser_state_hash`, not the raw nonce. Move assertion nonces live in `mth_profile_transfer.assertion_nonces`.

Specialist channel guard: a Move post of `commitProfileSave` or `consumeProfileSaveContinuation` throws `unauthorized`.

v23 SQL `v23_private.authority()` admits hub `move`, `insurance`, or `lender` only. Contractor, Senior, and Investor do not pass that check at this migration.

## 11. Save is not Watch

### FROZEN CONTRACT

Save MUST NOT create a Watch. Watch MUST be a separate explicit user action.

A specialist that cannot monitor MUST say that monitoring is not available, or an equivalent honest capability state. The product MUST NOT auto-enroll a Watch. Historical Watch consent MUST NOT be reinterpreted as consent for a new Watch.

### CURRENT IMPLEMENTATION

`consumer.save_entity` does not insert `consumer.consumer_watches`. The watch table comment says Save and Watch remain separate actions. `consumer.consumer_watches.saved_entity_id` is unique, so a later Watch attaches to one Saved row. Creation is `consumer.start_watch`, which is a different function.

The confirmation page states "Save does not start a Watch."

`isolatedConfig` returns null unless `MY_TRUSTHUB_WATCH_ENABLED`, `MY_TRUSTHUB_ALERTS_ENABLED`, and `MY_TRUSTHUB_SOURCE_MONITORING_ENABLED` are the string `false`. ARCH-004 runs only inside that closed gate, so the proof MUST show no Watch row and MUST NOT enable those flags.

`network.watch_capabilities.watch_eligible` defaults false and cannot be true unless `governance_status` is `approved`.

## 12. Universal six-hub specialist contract

### FROZEN CONTRACT

Every specialist hub MUST eventually implement:

- guest or device Save
- a Keep in My TrustHub action
- an opaque specialist-to-Ask handoff
- receipt-aware My TrustHub state
- a deep-link or Continue contract where tool state exists
- an honest Watch capability

No specialist hub MAY implement, as a network source of truth, a separate consumer `auth.users` identity, parent Projects, parent account Saved authority, email-only identity merge, a Save-created Watch, or a browser-selected Ask UUID.

Contractor, Senior, and Investor MUST NOT grow a new Generation 1 headquarters architecture. Senior and Investor have no consumer identity provider today and MUST NOT gain one. Persons use Ask.

### CURRENT IMPLEMENTATION

Move at PR #169 is the only specialist with the reviewed Keep and handoff adapter. Insurance and Lender remain Generation 1 surfaces under ARCH-001. Contractor's older `POST /api/my-trusthub/issue` route MUST stay unused. V2 MUST NOT reuse it.

The v23 authority hub list in section 10 does not admit Contractor, Senior, or Investor.

### FUTURE MIGRATION

After Move certification, the authorized specialist order recorded in program memory is Investor, Senior, Contractor, Lender, then Insurance, one isolated branch at a time. That order is not executed by this ticket. Each hub still has to meet this contract. A packet that is waiting is not an implementation.

## 13. Generation 1 compatibility

### FROZEN CONTRACT

My Move, My Insurance, and My Lending MUST remain available until their migration and cutover gates are satisfied. This ticket MUST NOT delete them and MUST NOT redirect them.

Their tool runtimes MUST survive. Their status as consumer identity or account authorities MUST NOT survive the cutover.

Legacy cloud state MUST eventually be read-compatible, then explicitly imported, then closed to new authenticated writes, and retained through a rollback window.

Bulk email merge is forbidden. Destructive migration is forbidden.

### CURRENT IMPLEMENTATION

ARCH-001 section 15 is the fate table: `arepfylnilkjmyduhwbz` is a bridge as a consumer identity provider and stays the Move evidence store; `gojyhmbojbwbpiamoktq` and `hidcrbexurginnuqgipx` stay specialist databases while their consumer sessions migrate later. Move-bridge SSO remains the historical Insurance and Lender redirect default until V2 continuation is proven.

Generation 1 Move tables for saved movers, inventories, and plans are specialist tool state. They are not Ask account Saves.

## 14. Session and auth

### FROZEN CONTRACT

Ask MUST own network consumer authentication. A specialist MUST NOT become an independent permanent consumer identity host.

If a specialist needs a temporary authenticated round trip, that round trip MUST be derived from Ask authorization and MUST be bounded by the capability rules in section 5.

Network sign-out MUST NOT leave the consumer logged out of Ask and permanently signed in to a specialist account as if that specialist account were the network identity.

Generation 1 Move-bridge SSO is transitional. It retires after V2 continuation is proven. This ticket does not retire it.

### CURRENT IMPLEMENTATION

`accountRuntime` is the login admission rule and does not hardcode `xkkiicsassizmakcvxml`. Production admits only `https://www.asktrusthub.com` with `https://qvvxvbcdmbjzrgvwjatw.supabase.co`. Off production it admits the configured test origin and test Supabase URL when the non-production checks in ARCH-001 pass. `isolatedConfig` is the stricter profile-save pin and is not on the login path. `isolatedSaveAccount` refuses signup, email-link, recovery, and password-change on the reviewed preview while still allowing login.

ARCH-002 proved a password login for USER_A on the reviewed Ask preview against `xkkiicsassizmakcvxml`. Production `/my/sign-in` on the pre-V2 main SHA remains the magic-link canary.

Move isolated browser auth, when admitted, uses `zvoijbohtyuhqfuvteoy` and does not build a production service-role client. That is specialist preview auth, not the canonical consumer subject.

## 15. Business and consumer separation

### FROZEN CONTRACT

`/my` MUST remain the consumer private workspace. `/manage` MUST remain the business and owner workspace.

The same human MAY eventually use both. Consumer Saved rows, Projects, Watches, and private research MUST NOT become visible inside Business Manager by accident. A business claim MUST NOT create a consumer Save. A consumer Save MUST NOT create business claim state.

### CURRENT IMPLEMENTATION

`consumer.consumer_profiles` says business roles grant no access. P19 deletion comments say Business Manager authorization is outside consumer-workspace deletion. ARCH-001 places `ATH_HANDOFF_SECRET` and `/manage` off the consumer identity drawing. No code in the profile-save path writes a claim.

### UNKNOWN

The live claim user store was not identified by ARCH-001 and was not queried here.

## 16. Delete and export

### FROZEN CONTRACT

Ask MUST orchestrate consumer export and consumer deletion.

For a specialist private tool object, Ask MUST send a server-side BFF request that names the opaque specialist object. The browser MUST NOT fan the consumer UUID or email out to specialist hubs.

The specialist MUST return an export or a tombstone or delete acknowledgement under that contract.

Public evidence MUST NOT be deleted when private consumer state is deleted.

This ticket does not implement export or deletion.

### CURRENT IMPLEMENTATION

P19 defines `ops.consumer_export_jobs` and `ops.consumer_deletion_jobs`. Export artifacts expire after seven days and use authenticated opaque storage references. Deletion is checkpointed, has a seven-day grace period, and does not include shared network or business state. The migration is marked validation-only until separately approved. No BFF in the reviewed profile-save path sends an opaque private-object delete.

### UNKNOWN

Whether these P19 relations exist on either Ask project was not re-queried. An earlier QA read did not find relation names matching export or delete. This ticket does not upgrade that earlier observation into a current census.

## 17. Observability

### FROZEN CONTRACT

Logs MAY include an event name, a stage, a bounded sanitized error code, an operation outcome, and an opaque internal receipt or reference when that reference is safe to store server-side.

Logs MUST NOT include a password, a secret key, an auth token, a raw continuation secret, the consumer email on a public handoff log, an unnecessary consumer UUID, or a private tool payload.

### CURRENT IMPLEMENTATION

Confirmation failure logging is one JSON object: `event` `my_trusthub_v23_confirmation_failure`, `stage` `consume_continuation`, and `code` from `diagnosticCode`. Codes are bounded to 32 characters of letters, digits, and underscores, or the literal `unknown`.

P13 `ops.consumer_handoff_events` records `handoff_kind`, `action`, and `reason_code`. Its comment excludes raw code, state, nonce, token, Project payload, and URL query.

`SaveMoverButton` logs a cloud soft-fail object and a caught error to the console. Those calls are specialist UI diagnostics. They are not the parent receipt log. ARCH-004 evidence MUST NOT paste credentials out of them.

## 18. Environment

### FROZEN CONTRACT

| Environment | Project |
| --- | --- |
| Production Ask consumer authority | `qvvxvbcdmbjzrgvwjatw` |
| Isolated Ask QA | `xkkiicsassizmakcvxml` |
| Move isolated preview | `zvoijbohtyuhqfuvteoy` |

The live specialist topology in ARCH-001 remains authoritative: Move production `arepfylnilkjmyduhwbz`, Insurance `gojyhmbojbwbpiamoktq`, Lender `hidcrbexurginnuqgipx`. Contractor and Senior live database refs that ARCH-001 left unknown stay unknown.

A preview MUST NOT silently fall back to production. `accountRuntime` and `isolatedConfig` MUST remain separate concepts. Secret values MUST NOT be copied into this contract or into tickets that cite it.

Admission detail is ARCH-001. Builders MUST use that map rather than a second copy of the env census.

### CURRENT IMPLEMENTATION

`isolatedConfig` returns a config only when all of the following hold: `VERCEL_ENV` is `preview`, profile-save and the saved and specialist-handoff flags are the string `true`, `accountRuntime` admits exactly the Ask preview alias plus `https://xkkiicsassizmakcvxml.supabase.co`, the V2 parent and Move origins are the two reviewed aliases, session affinity is `dedicated`, access mode is `invitation`, signup, email, Watch, alerts, and source monitoring are the string `false`, invited user ids are exactly two distinct UUIDs, and invited emails are empty.

Reviewed aliases:

- Ask: `https://conumers-trust-hub-git-mth-v2-3-pare-3127df-savitz25-s-projects.vercel.app`
- Move: `https://move-trust-hub-git-mth-v2-3-move-cur-0a05f1-savitz25-s-projects.vercel.app`

The last certified Ask deployment for USER_A login is `dpl_3g13PFDAbKEN8tRoUDY4wb4eUifj` at SHA `b885a651d1b229f8c6acbc5888733af08f4a5e5d`. This ticket did not re-list Vercel deployments. ARCH-004 MUST confirm the deployment id still serves that SHA before the proof.

The exact Move deployment id for `73bc86e503a57fc52d420a1c339c7fd8b912e2af` was not re-read. The alias above is the reviewed origin. ARCH-004 MUST record the deployment id before the proof. The older `move-par-71a0b3` alias is stale.

## 19. ATH-MTH-ARCH-004 entry

ARCH-004 MUST NOT start until every line below is true. This ticket does not execute the proof.

- USER_A auth remains PASS. ARCH-002 is the record. Do not log in again merely to restate it.
- The temporary admin key used for the password repair stays revoked and is not recreated.
- PR #185 is still exactly `b885a651d1b229f8c6acbc5888733af08f4a5e5d`, or a newer reviewed head is written down before the proof. An unreviewed head MUST NOT be used.
- Move PR #169 is still exactly `73bc86e503a57fc52d420a1c339c7fd8b912e2af`, or a newer reviewed head is written down before the proof.
- The Ask preview deployment id and SHA are recorded.
- The Move preview deployment id and SHA are recorded.
- `isolatedConfig` would accept the preview environment, including the string-false signup, email, Watch, alerts, and source-monitoring flags.
- Public signup is off. Email is off. Watch is off. Alerts are off. Source monitoring is off.
- User A and User B are the invited pair. No additional public account is created for the proof.
- Production is not mutated. `qvvxvbcdmbjzrgvwjatw`, `arepfylnilkjmyduhwbz`, and the other production specialist projects stay untouched.
- The Move certified-publication gate in section 22 is satisfied for the reviewed mover, or a later ticket has deliberately prepared that relation and its `PUBLISHABLE` row. Until then ARCH-004 stays blocked. Live Move preview satisfaction of that gate remains UNKNOWN.

Expected journey, not executed here:

1. Open the reviewed Move profile for slug `hindman-isaacs-moving-storage-inc` (native id `usdot-1002530`, class `mover`).
2. Save the mover on the device.
3. Choose Keep this in My TrustHub.
4. Complete the Ask session on the reviewed preview.
5. Submit Confirm Save on `/my/profile-save`.
6. Observe the parent receipt outcome `saved` or `already_saved`.
7. Open `/my/saved` and see that entity.
8. Confirm the device copy is still present and no Watch was created.

## 20. ATH-MTH-ARCH-004 success bar

PASS requires evidence for every item below. A missing item is a fail or a recorded delta. This ticket does not produce that evidence.

| Check | Required evidence |
| --- | --- |
| Move profile loaded | The certified slug renders on the reviewed Move preview. |
| Save mover usable | The Save mover control can be operated on the hosted profile. Keyboard behavior and `DeferredSaveMyMove` are NEEDS_TEST_ONLY observations for that proof. This contract does not certify a workaround for either. |
| Device Save | Local shortlist gains the slug. UI may say saved on this device. |
| Handoff starts | Keep this in My TrustHub posts the continuation and leaves the Move origin for `/my/profile-save`. |
| Ask session | The admitted preview session is accepted. A missing session shows "Sign in to continue" and MUST NOT commit. |
| Explicit confirmation | The page shows the checkbox "Save these selected profiles to this account" and the button "Confirm Save". |
| Continuation consumed | One successful `consumeProfileSaveContinuation`. A second consume conflicts. |
| Parent commit | `commitProfileSave` runs on Ask. Move does not call it. |
| Parent receipt | Server receipt with `parent.outcome` `saved` or `already_saved` and a `savedRef`. |
| `/my/saved` | The exact specialist entity is visible for that consumer. |
| Device copy | The local shortlist row remains. |
| Watch | No `consumer.consumer_watches` row is created by the Save. |
| Idempotency | A repeated Save of the same entity does not add a second `consumer_saved_entities` row. |
| Production | No production project, header, or Auth setting changes. |

If `readCertified` does not receive one matching `PUBLISHABLE` row from `mth_profile_transfer.certified_publication`, `prepare` returns `local_only` with `IDENTITY_REVIEW_REQUIRED` before `prepareGuestProfileTransfer`. The parent Save and P13 commit path do not start, and the receipt checks cannot pass. That outcome is a failed proof, not a waiver. Whether the live Move preview already satisfies this row remains UNKNOWN. `public.companies.publication_state` is a different object.

## 21. Production header cutover

One Move receipt is not permission to change production headers.

Before any public header or marketing-copy cutover, all of the following MUST be true:

- User A has passed the receipt path.
- User B has passed the receipt path.
- A repeated Save is idempotent.
- Logout and a later login restore the Saved row.
- A second device can see the Saved row through the account, not through a copied browser store.
- Continue reopens the real tool state for any private object the cutover claims to preserve. A public profile link alone does not satisfy this line when the cutover copy talks about inventories, baskets, or scenarios.
- Rollback has been proven.
- One Generation 1 import dry-run has been proven.
- One clean hub proof has been completed.

This ticket changes no header.

## 22. Implementation delta register

Gaps are classified only. Nothing in this list is fixed here.

| Gap | Class | Why it matters |
| --- | --- | --- |
| Public profile journey code exists on the two reviewed heads: Move prepares and verifies; Ask confirms and commits; local copy is kept; Save does not call `start_watch`. | READY | ARCH-004 can aim at this path. It does not require a new product design. |
| P12 dedup `(auth.uid(), canonical network entity)` plus unique `(user_id, network_entity_id)`. | READY | Repeated public-entity Save updates one row. |
| USER_A auth on the reviewed Ask preview. | READY | ARCH-002. Auth PASS is separate from the receipt proof. |
| `ops.v23_profile_runtime_records` on `xkkiicsassizmakcvxml`. | READY | G-B2 read-only confirmation: the relation is present and the columns and `kind` values are compatible with the reviewed runtime. Row contents were not copied. |
| Accepted Ask QA binding for the reviewed mover. | READY | G-B2 confirmed `PRESENT_AND_ACCEPTED`. It resolves to one active accepted canonical network entity. No consumer identity is recorded here. |
| Save ≠ Watch architecture. | READY | `consumer.save_entity` does not insert `consumer.consumer_watches`. |
| Save mover keyboard behavior. | NEEDS_TEST_ONLY | The hosted proof still has to operate the control. No workaround is certified. |
| `DeferredSaveMyMove` on a company profile. | NEEDS_TEST_ONLY | On routes other than `/my-move` and `/portal`, the reviewed component waits for interaction, or a long idle, before it mounts `SaveMyMoveProvider`. The independent review did not require a code change before ARCH-004. No workaround is certified. |
| Ask and Move deployment ids for the exact SHAs. | NEEDS_TEST_ONLY | Ask login deployment `dpl_3g13PFDAbKEN8tRoUDY4wb4eUifj` was not re-listed. The Move deployment id is unrecorded. Record both before the proof. No code change is implied by the missing id. |
| `mth_profile_transfer.certified_publication`. | NEEDS_CODE_BEFORE_ARCH-004 | REVIEWED CODE/SQL GAP = CONFIRMED. LIVE MOVE PREVIEW SATISFACTION = UNKNOWN. Move PR #169 head `73bc86e503a57fc52d420a1c339c7fd8b912e2af` reads this relation from `lib/my-trusthub/hosted-runtime.ts` before parent preparation proceeds. `supabase/migrations/20260921154559_move_v23_source_stage.sql` creates `stages`, `quota`, and `assertion_nonces`. It does not create `mth_profile_transfer.certified_publication`. `public.companies.publication_state` is a different object and is not what `resolveExactPublished` reads. `hosted-runtime.test.ts` mocks the query and is not hosted schema evidence. A missing or nonmatching row makes `readCertified` return null, `prepare` return `local_only` with `IDENTITY_REVIEW_REQUIRED`, and that return happens before `prepareGuestProfileTransfer`, so the parent Save and P13 commit path do not start. One matching `PUBLISHABLE` record for native id `usdot-1002530`, slug `hindman-isaacs-moving-storage-inc`, and class `mover` is sufficient for this publication gate when reader permissions and the other dependencies are valid. This contract does not say the live preview row is absent. Until that live state is proven, or a later ticket deliberately prepares the relation and row, ARCH-004 remains blocked. This ticket does not create the relation or insert the row. |
| Several handoff windows coexist: P13 maximum 120 seconds, P13 issue and exchange matcher 90 seconds, preview exchange 85 seconds, current-grant challenge 90 seconds, stage and grant 600 seconds. | POST-ARCH-004_HARDENING | The proof can finish inside the shortest live window. Do not treat these as one TTL, and do not change them in the receipt ticket unless a failure proves the windows disagree. |
| v23 `authority()` admits only `move`, `insurance`, and `lender`. | POST-ARCH-004_HARDENING | It does not block the first Move proof. Contractor, Senior, and Investor need a reviewed admission change before their own receipt proofs. |
| Private tool pointer (`opaque_object_id` and the other addendum fields as stored columns) and private Continue rehydration. | PRE-MASS-MIGRATION_REQUIRED | Required before inventories, baskets, or scenarios move. Not required for the first public profile receipt. |
| Encrypted specialist backup that is not the live working set. | PRE-MASS-MIGRATION_REQUIRED | Named by the frozen contract. No column was found. |
| Generation 1 read-compatible import, write freeze, and rollback window. | PRE-PRODUCTION_REQUIRED | Required before header cutover and before legacy authenticated writes stop. |
| User B receipt, second device, logout restore, and clean-hub proof. | PRE-PRODUCTION_REQUIRED | Section 21. One User A receipt does not open production headers. |
| P19 export and deletion BFF using opaque object ids. | PRE-PRODUCTION_REQUIRED | Schema is validation-only. No specialist tombstone protocol is implemented. |
| Production magic-link `/my/sign-in` versus the preview password form. | PRE-PRODUCTION_REQUIRED | ARCH-001. Header and auth UX cutover stay locked. |
| Email-only identity merge. | READY as a prohibition | `ops.consumer_identity_links` forbids it. Do not build a merge. |

### Pre-ARCH-004 state after 003R1

READY:

- USER_A auth
- Ask QA `ops.v23_profile_runtime_records`
- the accepted Move canonical binding
- the parent Saved and idempotency foundation
- the Save ≠ Watch architecture

NEEDS TEST:

- the exact Ask and Move deployment pins at execution time
- hosted Save control behavior, including keyboard use and `DeferredSaveMyMove`

CONFIRMED BLOCKER BEFORE ARCH-004:

`mth_profile_transfer.certified_publication` on the Move side. The reviewed mover must resolve as `PUBLISHABLE` through that relation before the first parent receipt proof can pass.

LIVE MOVE PREVIEW PUBLICATION STATE: UNKNOWN.

ARCH-004 immediate readiness: NO.

## 23. Prohibitions observed by this ticket

This ticket did not run P13, did not perform a profile Save, did not log in, did not reset users, did not recreate an admin key, and did not modify Supabase, Vercel, production, product code, SQL, RLS, or headers. It did not migrate Generation 1 users, did not start six-hub rollout, and did not start ARCH-004. PR #185 and Move PR #169 were read and were not changed.

ATH-MTH-ARCH-003R1 is the same kind of correction. It does not create `mth_profile_transfer.certified_publication`, does not insert a `PUBLISHABLE` row, does not modify PR #185 or Move PR #169, does not query or write a preview or production database, and does not start ARCH-004.
