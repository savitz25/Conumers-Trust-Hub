# Packet 18 hosted-operator fixture

This note records the local fixture behind `scripts/qa/v23-packet18-operator-ownership-postgres.mjs` and its metadata helper. It is not production SQL. The five candidate SQL files stay byte-identical to reviewed head `1ead987880c6620a8bede19cf5c223201f181169` (and the earlier SQL repair head `ca1a58acdcb0c7d7f11ed69d6b60e94ae1cc5cf8`). Production remains stopped at Packet 18. This fixture correction is for C-B1 review, not a merge or production-resume authorization.

## Original evidence and separate supplement

The files actually used were delivered under `C:\Users\makei\mth-pr262-evidence`. Byte-for-byte copies are committed in `scripts/qa/fixtures/pr262-metadata/`; that directory disables Git text conversion. The metadata helper checks raw file SHA256 before parsing JSON. The supplement query is retained as provenance and is never executed by this test.

| File | Observation | SHA256 |
| --- | --- | --- |
| `operator-evidence.json` | October 6, 2026, 9:13–9:14 PM Eastern | `fd1b5bd77d8d8f50d2249678c355c034a70af14f28b9a59ec9425fc25e67827a` |
| `binding-dependency-evidence.json` | October 6, 2026, 9:39 PM Eastern | `809ac10be00402de39b6ecfdde094154fe8ff54a296edaf3f176098a486ea75f` |
| `pr262-supplement-20261007-result.json` | October 7, 2026, 10:50:50 AM Eastern | `f55eff781e11bb0e5e6a27d95a0abcdad8f0ff18042516a397022c3be0bfd0c1` |
| `pr262-supplement-20261007-query.sql` | Query named in the supplement and its `SHA256SUMS` | `f05f94fb46b5309793f4b8e65c1dbdc39153f32354e8ac6d0a1183687347235f` |

The October 6 originals are selected catalog extracts, not a complete export. The October 7 supplement is a separate observation, not a regeneration of those originals. Their recorded limitations still apply. The previous C-B1 results remain unchanged outside the repository; this correction reruns the affected local proof.

## Role substitution

Ask production's operator is the session user `postgres`: `NOSUPERUSER`, `BYPASSRLS`, `INHERIT`, `CREATEROLE`, PostgreSQL 17.6, project `qvvxvbcdmbjzrgvwjatw`. The embedded cluster's bootstrap superuser is already named `postgres`, so the fixture role is `hosted_operator`. Owner, grantor, and grantee values observed as `postgres` are mapped to `hosted_operator`. The bootstrap role is not left as the only owner of those dependencies.

The operator's LOGIN attribute also matches the original extract. Role OIDs are never compared across databases. The local bootstrap superuser named `postgres` remains a separate setup identity; its name is not treated as evidence of production ownership. `supabase_admin` and `myth_*` retain their recorded names. Unrecorded fixture support is identified below rather than presented as production metadata.

## Verified catalog facts

- `network.request_actor()` owner is the operator, `SECURITY INVOKER`, operator `EXECUTE` is true, source MD5 is `043d6f9b6cabdd24c12efd6571c4f64a`, and the ACL includes `postgres=X/postgres`. Locally that entry is `hosted_operator=X/hosted_operator`.
- The migration body is unchanged. This checkout stores that migration with CRLF, and PostgreSQL keeps those carriage returns inside `prosrc`, which changes the MD5. The fixture applies migration files with LF line endings, the bytes Git stores, and that `prosrc` MD5 is the observed production value.
- A `SELECT` of `network.request_actor()` returns `session_user`.
- `network.network_entity_bindings.created_by` defaults to `network.request_actor()`. The fixture does not assign `created_by` and does not remove the default.

## Explicit ownership map

Owned by `hosted_operator` after the map:

- functions: `network.request_actor()`, `network.audit_identity_governance()`, `network.set_updated_at()`, `network.resolve_canonical_entity(uuid)`, `ops.origin_allowed(text,text,text)`, `v23_private.authority()`
- tables: `network.network_entities`, `network.network_entity_bindings`, `network.network_entity_redirects`, `network.identity_governance_events`, `ops.consumer_hub_registry`, `consumer.consumer_saved_entities`
- schemas: `network`, `ops`, `v23_private`, `consumer`

`v23_private.authority()` is included because the migration creates it without a later `ALTER OWNER`, and Packet 19 replaces it in place. `ops.consumer_hub_registry` is included because `ops.origin_allowed` is `SECURITY DEFINER` and reads that forced-RLS table; the non-superuser owner must own the table. The identity sequence follows the events table. Migration grants to `myth_identity_governor` stay in place.

The October 7 supplement confirms `consumer` and `consumer.consumer_saved_entities` ownership and effective operator access. Packet 19 rollback executes `select 1 from consumer.consumer_saved_entities` as the applying role. The rest of `consumer`, including `consumer.consumer_notes`, stays owned by the local bootstrap role; those production ownership facts are NOT_IN_EXTRACT. `auth` remains local bootstrap scaffolding. Objects already owned by `myth_v23_foundation` or `myth_v23_prod_reader` stay there. There is no blanket ownership transfer.

## Membership

Initial observed membership of `hosted_operator` in `myth_identity_governor`, `myth_v23_foundation`, `myth_v23_parent_prod`, and `myth_v23_prod_reader` has grantor `supabase_admin`, `ADMIN=true`, `INHERIT=false`, `SET=false`. The governor row is present in both the original operator file and supplement. The parent-runtime row is from the supplement. Each packet's own `GRANT ... GRANTED BY current_user` adds the temporary foundation/reader `SET` row; its `REVOKE` removes only that row. Governor and runtime membership are never used to execute a packet. Initial `SET ROLE` attempts for all four roles must fail.

`myth_v23_parent_prod` is LOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT, NOCREATEDB, NOCREATEROLE, NOREPLICATION, with connection limit 6 and no validity deadline. Its settings are exactly `statement_timeout=5s`, `lock_timeout=3s`, and `idle_in_transaction_session_timeout=10s`. Its password is NULL locally. Its two observed outbound memberships, to `myth_v23_authorizer` and `myth_v23_executor`, are granted by `hosted_operator` with `ADMIN=false`, `INHERIT=false`, `SET=true`. Packets still execute under the non-superuser `hosted_operator` session.

### Explicit local support, not observed production privileges

[PostgreSQL 17 requires a non-bootstrap membership grantor to retain ADMIN OPTION](https://www.postgresql.org/docs/17/sql-grant.html). The substituted operator is not the embedded cluster's bootstrap role. To construct the recorded grantor-specific runtime edges, the local bootstrap grants `hosted_operator` ADMIN on authorizer/executor, with both INHERIT and SET false. These two support edges are NOT_IN_EXTRACT and are not a claim about production operator privileges. The packet SQL does not use them. The local `supabase_admin` also holds ADMIN-only support memberships for the four roles it grants, just as the previous fixture already required for foundation/reader. Its actual production attributes and support memberships are NOT_IN_EXTRACT. All local support edges are included in preservation checks, never added or removed during packet execution.

The schema ACL names three grantees absent from the base migrations: `myth_alert_runtime`, `myth_p15_dbpr_runtime`, and `myth_v23_receipt_consumer`. They are inert local NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT/NOCREATEROLE identities with only their observed consumer USAGE grant. Their production role attributes are NOT_IN_EXTRACT. No specialist migration is applied.

## Four-item comparison

| Item | Result and assertion |
| --- | --- |
| Governor membership | MATCH: original/supplement agree; role, member, grantor and all three options are checked before and throughout execution. |
| Runtime attributes and relevant memberships | MATCH: every supplied attribute, connection limit, exact setting name/value and observed edge is checked. Local support edges are separately enumerated above. |
| Consumer schema | MATCH: owner and operator USAGE/CREATE, plus all 16 supplied ACL entries, match after `postgres` → `hosted_operator` substitution. No additional observed-role grants are accepted. |
| Saved table | MATCH: owner, SELECT/INSERT/UPDATE/DELETE, enabled/forced RLS, complete two-entry ACL and sole policy name match the supplement. |

The consumer ACL gives owner USAGE/CREATE, and USAGE only to `authenticated`, `myth_consumer_api`, `myth_alert_fanout`, `myth_notification_delivery`, the seven `myth_bff_*` roles, `myth_alert_runtime`, `myth_p15_dbpr_runtime`, `myth_v23_foundation`, and `myth_v23_receipt_consumer`. Every grantor maps to `hosted_operator`. The saved-table ACL remains owner `arwdDxtm` plus `authenticated=r`, both granted by the owner. The runtime role receives no direct consumer USAGE or saved-table SELECT.

The supplement records the policy name, not its predicate. The migration's existing SELECT policy for `authenticated`, `((select auth.uid()) = user_id)`, is retained unchanged and behavior-tested with an owning and non-owning JWT subject. The predicate's exact production text is NOT_IN_EXTRACT; the test does not invent an observation for it. Metadata snapshots compare the complete local predicate and ACLs before/after all remaining forward and reverse steps.

## Affected proof and SQL freeze

`npm run check:my-trusthub-v2-packet18-operator` passed with all four corrections. It constructs the disposable local six-binding/Packet-15 partial state, preserves the six existing IDs, generates nine new receipts and fifteen total intended bindings, and reaches authority fingerprint `17f464ad69f3d8c7a89dd2cf9229f112`. It uses Insurance TX `9982` and Contractor `CGC1517216`. The complete reverse closes fifteen local receipts and restores `691e2f2e05426c60af8fa3a54f38eac9`. The Packet 19 saved-table read executes as the modeled operator with forced RLS and the observed ACL still intact. No production packet is run.

The original request_actor/default/audit-trigger checks, negative permission controls, Saved research/notes/project-membership digest and Move checks remain. A nonempty `fixture_only.watch_state` preservation sentinel is included in the digest. It is local oracle data, not a claimed reconstruction of production Watch tables, which the supplied extracts do not inventory. No Watch canary is activated.

The harness hashes Git blob bytes for the five frozen SQL files, separately from the LF-normalized execution copies. Publication validation also compares old/new Git blob payloads directly.

| Frozen SQL file | SHA256 of Git blob payload |
| --- | --- |
| `18-ask-prod-senior-hub-context-forward.sql` | `72e0a3cfd276c0002a8dc5c712c0c91851869588b99065c44e26439366881e38` |
| `18-ask-prod-senior-hub-context-rollback.sql` | `b7a7e06713f5b61245eedfe2e99a4c99b3346bc5b5df77c4433647f8106608e1` |
| `15-ask-prod-hub-account-context-rollback.sql` | `f1ce07cd207d8d0f7645a7d2ecb92b6641d762b7b6093982efc0b7fba0e207ce` |
| `14-ask-prod-investor-context-rollback.sql` | `6678823d2466ce60c98e016b03f70bd09eb8c1c16cda9d4cc5e94668510bcbeb` |
| `14-ask-prod-investor-crd-binding-forward.sql` | `453565ecd5b6ef454fed1979f7ccee6b46027647699f825080940032b0307664` |

`fixture_only.saved_research_digest()` is a local oracle for observing preserved data without expanding the operator's modeled access to notes and project tables. The packets do not call it.
