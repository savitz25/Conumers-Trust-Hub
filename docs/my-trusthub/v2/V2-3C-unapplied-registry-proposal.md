# V2-3C Insurance profile return registry — UNAPPLIED proposal

No database was queried or changed. This is a review package outside `supabase/migrations`, not an auto-applied migration. It must be promoted with the supported migration generator only under a future approved runtime package.

## Why a bare prefix addition is rejected

P13's existing `ops.normalize_return_path(hub,path)` accepts any descendant of `allowed_return_prefixes`. Adding `/providers` to that array alone is insufficient. It has no captured identity argument, so it cannot ensure return to the selected profile. The old function/routes remain unchanged in this ticket; they must continue rejecting the new route until the bounded facade is implemented.

The new capability is a typed template, not an arbitrary browser URL:

| Hub | Public profile template | Production origin |
| --- | --- | --- |
| move | `/companies/{canonicalSlug}` | `https://www.movetrusthub.com` |
| insurance | `/providers/{canonicalSlug}` | `https://www.insurancetrusthub.com` |
| lender | `/lenders/{canonicalSlug}` | `https://www.lendertrusthub.com` |

The application contract `profileReturnDestination` / `validateProfileReturn` implements these exact templates. Its `ProfileReturnTask` must be resolved server-side from the exact reviewed identity, not deserialized and trusted from the browser. It normalizes/decodes, rejects traversal (even if it normalizes to the expected path), external/protocol-relative/backslash/recursive/extra-path/query/fragment variants and compares against ONE captured canonical profile destination. It does not use prefix matching.

Isolated QA supplies an explicitly reviewed origin/backend registry. It never falls back to a production origin. Production uses only the stated canonical host. This ticket adds no staging origin, BFF scope or credential to the live registry.

## Proposed migration payload

The future migration adds separate metadata; it deliberately does NOT broaden the existing prefix array or replace any existing origin/scope.

```sql
begin;
alter table ops.consumer_hub_registry
  add column profile_return_templates jsonb not null default '{}'::jsonb
  check (jsonb_typeof(profile_return_templates) = 'object');
update ops.consumer_hub_registry
set profile_return_templates = '{"profile":"/companies/{canonicalSlug}"}'::jsonb
where hub_key = 'move';
update ops.consumer_hub_registry
set profile_return_templates = '{"profile":"/providers/{canonicalSlug}"}'::jsonb
where hub_key = 'insurance';
update ops.consumer_hub_registry
set profile_return_templates = '{"profile":"/lenders/{canonicalSlug}"}'::jsonb
where hub_key = 'lender';
commit;
```

This metadata migration is **not sufficient to activate a return**. The runtime implementation package must extend P13's broker with a typed profile-return path: the authenticated parent/BFF service resolves the stored return context and current binding/publication; selects the environment's registered origin; constructs and validates the exact canonical destination; stores that normalized path in the browser-bound exchange transaction. Consumption must compare to that captured server path. It must not call the older broad-prefix entry point with an unchecked browser path. No general client-supplied `canonicalSlug`, URL or consumer ID becomes authority.

The reusable typed facade is the only caller allowed to introduce this context; existing P13 scopes remain the outer authorization ceiling, never blanket table access. Implementation needs reviewed broker/RLS/CSRF tests and isolated transaction tests before this metadata or facade is enabled. The current pure model is not that transaction implementation.

## Exact reversal / rollout gate

Before applying, record the then-current schema and rows in the approved release evidence (not secrets). If the column already exists, stop and reconcile rather than overwriting concurrent work. Apply only with the corresponding disabled-by-default facade and atomic-consumption tests ready. Do not activate registration as part of this change.

To disable this capability, first close only the new profile-transfer entry point, allowing in-flight authorized receipt lookup to finish. Then remove only matching introduced template keys; do not revert unrelated registry fields or delete research:

```sql
begin;
update ops.consumer_hub_registry
set profile_return_templates = profile_return_templates - 'profile'
where (hub_key = 'move' and profile_return_templates->>'profile' = '/companies/{canonicalSlug}')
   or (hub_key = 'insurance' and profile_return_templates->>'profile' = '/providers/{canonicalSlug}')
   or (hub_key = 'lender' and profile_return_templates->>'profile' = '/lenders/{canonicalSlug}');
commit;
```

Leave the additive column in place; dropping it could discard later capabilities. This reversal leaves legacy prefixes, current identity, local copies, parent Saves, Projects and receipts untouched. SQL execution/rollback tests are NOT RUN; no disposable Postgres environment was established. The TypeScript route contract is tested deterministically.
