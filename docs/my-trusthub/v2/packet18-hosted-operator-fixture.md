# Packet 18 hosted-operator fixture

This note records the local fixture behind `scripts/qa/v23-packet18-operator-ownership-postgres.mjs`. It is not production SQL. The five candidate SQL files named below stay byte-identical to commit `ca1a58acdcb0c7d7f11ed69d6b60e94ae1cc5cf8`.

## Role substitution

Ask production's operator is the session user `postgres`: `NOSUPERUSER`, `BYPASSRLS`, `INHERIT`, `CREATEROLE`, PostgreSQL 17.6, project `qvvxvbcdmbjzrgvwjatw`. The embedded cluster's bootstrap superuser is already named `postgres`, so the fixture role is `hosted_operator`. Owner, grantor, and grantee values observed as `postgres` are mapped to `hosted_operator`. The bootstrap role is not left as the only owner of those dependencies.

`operator-evidence.json` and `binding-dependency-evidence.json` were not in the workspace when this fixture was corrected. The facts below are the catalog facts supplied with the correction request, plus the migration objects the remaining sequence executes. No unpublished ACL row was added.

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

`consumer` and `consumer.consumer_saved_entities` are included because Packet 19 rollback executes `select 1 from consumer.consumer_saved_entities` as the applying role. The migration revokes public usage on that schema. The rest of `consumer`, including `consumer.consumer_notes`, stays owned by the bootstrap role. `auth` stays owned by the bootstrap role. Objects already owned by `myth_v23_foundation` or `myth_v23_prod_reader` stay there. There is no loop that reassigns every object in five schemas.

## Membership

Initial membership of `hosted_operator` in `myth_v23_foundation` and `myth_v23_prod_reader` is grantor `supabase_admin`, `ADMIN` true, `INHERIT` false, `SET` false. Each packet's own `GRANT ... GRANTED BY current_user` adds the temporary `SET` row. `REVOKE ... GRANTED BY current_user` removes only that row. `myth_v23_foundation`, `myth_v23_prod_reader`, and `supabase_admin` are not `BYPASSRLS`.

`fixture_only.saved_research_digest()` is a local oracle so the operator session can prove existing Saved research, notes, and memberships without a production grant on `consumer`. The packets do not call it.
