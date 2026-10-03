-- MY TRUSTHUB V2 PRODUCTION — MOVE EXACT-USDOT BINDING BATCH (ROLLBACK, operator).
-- Target qvvxvbcdmbjzrgvwjatw. PREPARED ONLY: needs a separate, explicit
-- binding-retirement authorization.
--
-- Retires EXACTLY the bindings named in the retained forward receipt, the way
-- the reviewed retirement packet does (final-parent-wiring/move-binding-teardown.sql):
-- it closes each binding's validity window and retires the same entity. No
-- DELETE, no redirect, no successor, no merge, no reassignment. Saved research
-- that references an entity is preserved. A retired binding is not returned by
-- the resolver, so those movers stop being eligible for an account Save.
--
-- The target is taken ONLY from the receipt (binding_id, network_entity_id,
-- usdot, provenance_ref). Nothing is rediscovered by name, slug or pattern. The
-- whole receipt, or any reviewed subset of its rows, may be loaded.
--
-- One psql session, ON_ERROR_STOP=1, project pinned OUTSIDE SQL first:
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   create temp table v23bulk_rollback(usdot text primary key,slug text,legal_name text,binding_id uuid not null unique,
--     network_entity_id uuid not null unique,provenance_ref text not null,valid_from timestamptz not null) on commit preserve rows;
--   \copy v23bulk_rollback from '11-receipt-<date>.csv' csv header
--   select set_config('v23.binding_retirement_authorized','true',false);
--   select set_config('v23bulk.rollback_expected_rows','<rows in the loaded receipt>',false);
--   \i 11-ask-prod-move-exact-usdot-batch-rollback.sql
--   revoke myth_identity_governor from <operator> granted by <operator>;
-- Re-running it for the same receipt stops at "Exact live forward binding
-- required" having changed nothing. Reopening a retired identity is a separate
-- reviewed operation: the reconciliation classifies it REVIEW_REQUIRED.
begin isolation level serializable;
set local statement_timeout='180s';
set local lock_timeout='3s';
-- A temporary table has no statistics; keep the set joins off nested loops.
set local enable_nestloop=off;
-- Lock before the first snapshot-bearing read in this SERIALIZABLE transaction.
lock table network.network_entities,network.network_entity_bindings in share row exclusive mode;
lock table network.network_entity_redirects in share mode;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw'
    or current_setting('v23.binding_retirement_authorized',true) is distinct from 'true' then
   raise exception 'Separate production binding retirement authorization required'; end if;
 if to_regclass('pg_temp.v23bulk_rollback') is null then
   raise exception 'Load the retained forward receipt into pg_temp.v23bulk_rollback first'; end if;
 if coalesce(current_setting('v23bulk.rollback_expected_rows',true),'') !~ '^[1-9][0-9]{0,5}$'
    or (select count(*)::text from pg_temp.v23bulk_rollback) is distinct from current_setting('v23bulk.rollback_expected_rows',true) then
   raise exception 'Loaded receipt rows differ from v23bulk.rollback_expected_rows'; end if;
 if exists(select 1 from pg_temp.v23bulk_rollback where usdot !~ '^[1-9][0-9]{0,8}$'
      or provenance_ref not like 'mth-v2-move-exact-usdot/%') then
   raise exception 'Receipt rows are not from the exact-USDOT batch'; end if;
end $$;
grant select on pg_temp.v23bulk_rollback to myth_identity_governor;
set local role myth_identity_governor;
do $$
declare expected integer:=current_setting('v23bulk.rollback_expected_rows')::integer;
  retired_at timestamptz:=clock_timestamp(); affected integer;
begin
 -- Rollback target proof: every receipt row is the exact, live, accepted
 -- binding this batch created, on the active entity it created.
 select count(*) into affected
 from pg_temp.v23bulk_rollback r
 join network.network_entity_bindings b on b.id=r.binding_id
 join network.network_entities e on e.id=r.network_entity_id
 where (b.network_entity_id,b.hub,b.specialist_entity_type,b.specialist_entity_id,b.identifier_namespace,
        b.source_identifier,b.source_identifier_normalized,b.jurisdiction,b.binding_status,b.provenance_ref,b.valid_from)
     is not distinct from (e.id,'move','mover','usdot-'||r.usdot,'fmcsa.usdot',r.usdot,r.usdot,'US','accepted',r.provenance_ref,r.valid_from)
   and b.valid_to is null and b.valid_from<retired_at
   and (e.entity_type,e.primary_hub,e.jurisdiction,e.status) is not distinct from ('organization','move','US','active')
   and e.canonical_public_profile_ref like '/companies/%';
 if affected<>expected then raise exception 'Exact live forward binding required: % of % receipt rows match',affected,expected; end if;
 if exists(select 1 from pg_temp.v23bulk_rollback r join network.network_entity_bindings other on other.id<>r.binding_id
     and (other.network_entity_id=r.network_entity_id or other.hub='move' and other.specialist_entity_id='usdot-'||r.usdot
       or other.identifier_namespace='fmcsa.usdot' and other.source_identifier_normalized=r.usdot)) then
   raise exception 'Ambiguous binding or other use of a canonical entity; steward review required'; end if;
 if exists(select 1 from pg_temp.v23bulk_rollback r join network.network_entity_redirects d
     on d.from_entity_id=r.network_entity_id or d.to_entity_id=r.network_entity_id) then
   raise exception 'Redirected identity cannot be retired by this packet'; end if;
 update network.network_entity_bindings b set valid_to=retired_at
   from pg_temp.v23bulk_rollback r where b.id=r.binding_id and b.network_entity_id=r.network_entity_id;
 get diagnostics affected=row_count;
 if affected<>expected then raise exception 'Retirement must affect exactly % bindings, affected %',expected,affected; end if;
 update network.network_entities e set status='retired'
   from pg_temp.v23bulk_rollback r where e.id=r.network_entity_id;
 get diagnostics affected=row_count;
 if affected<>expected then raise exception 'Retirement must affect exactly % entities, affected %',expected,affected; end if;
 if exists(select 1 from pg_temp.v23bulk_rollback r join network.network_entity_bindings b on b.id=r.binding_id
     where b.valid_to is distinct from retired_at or b.binding_status<>'accepted') then
   raise exception 'V23_BULK_ROLLBACK_FAIL: a binding was not retired exactly'; end if;
 raise notice 'V23_PROD_MOVE_EXACT_USDOT_BATCH_RETIRED % bindings at %',expected,retired_at;
end $$;
reset role;
commit;
-- A failure requires ROLLBACK and steward review, never a fallback DELETE.
-- Verification (requires 09), any usdot from the receipt: zero rows.
--   select count(*) from v23_private.prod_move_binding_for('usdot-<number>');
