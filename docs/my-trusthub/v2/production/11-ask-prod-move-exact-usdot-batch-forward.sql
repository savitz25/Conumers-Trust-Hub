-- MY TRUSTHUB V2 PRODUCTION — MOVE EXACT-USDOT BINDING BATCH (FORWARD, operator).
-- Target qvvxvbcdmbjzrgvwjatw. PREPARED ONLY: needs a separate, explicit
-- production binding-mutation authorization. Canary flags may stay as they are;
-- a new binding only makes a mover resolvable, the runtime still re-proves
-- Move publication on every Save.
--
-- It is packet 10 applied as one set: for every candidate that the
-- reconciliation classifies SAFE_NEW_BINDING at apply time it creates exactly
-- one canonical Move organization and one accepted fmcsa.usdot binding, with
-- the same columns and values packet 10 writes. INSERT only. No UPDATE, no
-- DELETE, no upsert, no merge, no name-based connection. Every other class is
-- left untouched.
--
-- SAME SESSION, in this order (psql, ON_ERROR_STOP=1):
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   \i 11-move-exact-usdot-candidates.sql
--   \i 11-ask-prod-move-exact-usdot-reconcile.sql        -- review counts + rows
--   select set_config('v23.binding_creation_authorized','true',false);
--   select set_config('v23bulk.expected_safe_new','<SAFE_NEW_BINDING count you reviewed>',false);
--   select set_config('v23bulk.candidate_unchanged','true',false);
--   select set_config('v23bulk.evidence_ref','<ledger ref: who authorized, when>',false);
--   \i 11-ask-prod-move-exact-usdot-batch-forward.sql
--   \copy (select * from pg_temp.v23bulk_receipt order by usdot::bigint) to '11-receipt-<date>.csv' csv header
--   revoke myth_identity_governor from <operator> granted by <operator>;
-- The reconciliation must have finished within two minutes of this file
-- starting, and the candidate manifest must be less than 24 hours old
-- (regenerate it otherwise). The operator's SET-capable myth_identity_governor
-- membership is temporary for this transaction.
--
-- Idempotent: a second run finds no SAFE_NEW_BINDING row and stops at the
-- expected-count guard having changed nothing. Any error rolls back the whole
-- batch; there is no partial apply.
-- Rollback: 11-ask-prod-move-exact-usdot-batch-rollback.sql with the receipt.
begin isolation level serializable;
set local statement_timeout='180s';
set local lock_timeout='3s';
-- Statistics on the identity tables lag a bulk insert and a temporary table has
-- none; hash/merge joins keep the set classification fast regardless.
set local enable_nestloop=off;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw'
    or current_setting('v23.binding_creation_authorized',true) is distinct from 'true' then
   raise exception 'Separate production binding mutation authorization required'; end if;
 if to_regclass('pg_temp.v23bulk_candidates') is null or to_regclass('pg_temp.v23bulk_classified') is null then
   raise exception 'Same-session candidates and reconciliation required'; end if;
 if to_regclass('pg_temp.v23bulk_receipt') is not null then
   raise exception 'A batch was already applied in this session; export its receipt and use a fresh session'; end if;
 if (select count(*)::text from pg_temp.v23bulk_candidates) is distinct from current_setting('v23bulk.manifest_rows',true)
    or (select encode(sha256(convert_to(string_agg(usdot||'|'||slug||'|'||legal_name,E'\n' order by usdot::bigint),'UTF8')),'hex')
        from pg_temp.v23bulk_candidates) is distinct from current_setting('v23bulk.manifest_sha256',true) then
   raise exception 'V23_BULK_MANIFEST_FAIL: loaded candidates differ from the generated manifest'; end if;
 if nullif(current_setting('v23bulk.enumerated_at',true),'')::timestamptz is null
    or nullif(current_setting('v23bulk.enumerated_at',true),'')::timestamptz < clock_timestamp()-interval '24 hours'
    or nullif(current_setting('v23bulk.enumerated_at',true),'')::timestamptz > clock_timestamp() then
   raise exception 'Fresh Move enumeration required: regenerate 11-move-exact-usdot-candidates.sql'; end if;
 if nullif(current_setting('v23bulk.reconciled_at',true),'')::timestamptz is null
    or nullif(current_setting('v23bulk.reconciled_at',true),'')::timestamptz < clock_timestamp()-interval '2 minutes'
    or nullif(current_setting('v23bulk.reconciled_at',true),'')::timestamptz > clock_timestamp()
    or current_setting('v23bulk.candidate_unchanged',true) is distinct from 'true'
    or char_length(btrim(coalesce(current_setting('v23bulk.evidence_ref',true),''))) not between 1 and 300 then
   raise exception 'Fresh same-session reconciliation and evidence ref required'; end if;
 if coalesce(current_setting('v23bulk.expected_safe_new',true),'') !~ '^[1-9][0-9]{0,5}$'
    or current_setting('v23bulk.expected_safe_new',true) is distinct from current_setting('v23bulk.reconciled_safe_new',true) then
   raise exception 'Reviewed SAFE_NEW_BINDING count required and must equal the reconciliation result'; end if;
end $$;
create temp table v23bulk_receipt(
  usdot text primary key,slug text not null,legal_name text not null,
  binding_id uuid not null unique,network_entity_id uuid not null unique,
  provenance_ref text not null,valid_from timestamptz not null
) on commit preserve rows;
grant select on pg_temp.v23bulk_candidates,pg_temp.v23bulk_classified to myth_identity_governor;
grant select,insert on pg_temp.v23bulk_receipt to myth_identity_governor;
set local role myth_identity_governor;
lock table network.network_entities,network.network_entity_bindings in share row exclusive mode;
do $$
declare expected integer:=current_setting('v23bulk.expected_safe_new')::integer; n integer;
  entities_before bigint; bindings_before bigint;
  provenance text:='mth-v2-move-exact-usdot/'||current_setting('v23bulk.manifest_sha256')||'/'||current_setting('v23bulk.enumerated_at')
    ||' '||btrim(current_setting('v23bulk.evidence_ref'));
begin
 -- Re-classified under the lock: anything that changed since the reviewed
 -- reconciliation stops the batch before the first write.
 select count(*) into n from pg_temp.v23bulk_classified where class='SAFE_NEW_BINDING';
 if n<>expected then raise exception 'V23_BULK_CHANGED: % SAFE_NEW_BINDING now, % reviewed; reconcile again',n,expected; end if;
 select count(*) into entities_before from network.network_entities;
 select count(*) into bindings_before from network.network_entity_bindings;
 with safe as (
   select usdot,slug,legal_name from pg_temp.v23bulk_classified where class='SAFE_NEW_BINDING'
 ), entity as (
   insert into network.network_entities(entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status)
   select 'organization',legal_name,'move','US','/companies/'||slug,'active' from safe
   returning id,canonical_public_profile_ref
 ), binding as (
   insert into network.network_entity_bindings(network_entity_id,hub,specialist_entity_type,specialist_entity_id,
     identifier_namespace,source_identifier,jurisdiction,binding_status,valid_from,provenance_ref,resolution_note)
   select entity.id,'move','mover','usdot-'||safe.usdot,'fmcsa.usdot',safe.usdot,'US','accepted',transaction_timestamp(),provenance,
     'My TrustHub V2 Move exact-USDOT batch; canonical organization, Move mover, exact USDOT '||safe.usdot||'. PUBLISHABLE, unique in the Move publication source at enumeration.'
   from entity join safe on entity.canonical_public_profile_ref='/companies/'||safe.slug
   returning id,network_entity_id,specialist_entity_id,provenance_ref,valid_from
 )
 insert into pg_temp.v23bulk_receipt(usdot,slug,legal_name,binding_id,network_entity_id,provenance_ref,valid_from)
 select safe.usdot,safe.slug,safe.legal_name,binding.id,binding.network_entity_id,binding.provenance_ref,binding.valid_from
 from binding join safe on binding.specialist_entity_id='usdot-'||safe.usdot;
 get diagnostics n=row_count;
 if n<>expected then raise exception 'V23_BULK_FAIL: % receipt rows, % expected',n,expected; end if;
 -- Postconditions. Any failure aborts the whole batch.
 if (select count(*) from network.network_entities)<>entities_before+expected
    or (select count(*) from network.network_entity_bindings)<>bindings_before+expected then
   raise exception 'V23_BULK_FAIL: row deltas are not exactly one entity and one binding per mover'; end if;
 if exists(select 1 from pg_temp.v23bulk_classified where class='SAFE_NEW_BINDING')
    or (select count(*) from pg_temp.v23bulk_receipt r join pg_temp.v23bulk_classified c using (usdot)
        where c.class='ALREADY_ACCEPTED' and c.claims_total=1 and c.binding_ids=array[r.binding_id] and c.entity_ids=array[r.network_entity_id])<>expected then
   raise exception 'V23_BULK_FAIL: a created binding is not the single exact accepted binding for its mover'; end if;
 raise notice 'V23_PROD_MOVE_EXACT_USDOT_BATCH_APPLIED % bindings',expected;
end $$;
reset role;
revoke all on pg_temp.v23bulk_receipt from myth_identity_governor;
-- The complete receipt: one row per created binding. Export it before closing
-- the session; it is the rollback target.
select count(*) as created,min(valid_from) as valid_from,min(provenance_ref) as provenance_ref from pg_temp.v23bulk_receipt;
commit;
-- Immediately after COMMIT:
--   \copy (select * from pg_temp.v23bulk_receipt order by usdot::bigint) to '11-receipt-<date>.csv' csv header
--   revoke myth_identity_governor from <operator> granted by <operator>;
--   select set_config('v23.binding_creation_authorized','',false), set_config('v23bulk.expected_safe_new','',false),
--     set_config('v23bulk.candidate_unchanged','',false), set_config('v23bulk.evidence_ref','',false);
-- Verification (requires 09), any three usdots from the receipt: exactly one
-- row each, accepted, same identity, entity active.
--   select binding_status,specialist_entity_id,source_identifier,jurisdiction,entity_status
--   from v23_private.prod_move_binding_for('usdot-<number>');
