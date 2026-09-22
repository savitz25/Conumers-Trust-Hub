-- PREPARED ONLY. SEPARATE steward authorization; never run against production.
-- Independently pin db.xkkiicsassizmakcvxml.supabase.co OUTSIDE SQL first.
-- The project GUC is an operator attestation, not host authentication.
-- Run teardown-preconditions.sql first, in this same drained operator session.
-- Required GUCs: v23.approved_project, v23.binding_retirement_authorized=true,
-- v23.binding_id, v23.network_entity_id, v23.binding_provenance_ref. IDs and
-- provenance MUST come from the retained, approved forward-apply result.
-- Retains accepted historical provenance, closes [valid_from,valid_to), and
-- retires the SAME entity. No DELETE, redirect, successor, merge, or reassignment.
begin isolation level serializable;
set local statement_timeout='15s';
set local lock_timeout='3s';
set local row_security=off;
-- Lock before the first snapshot-bearing read in this SERIALIZABLE transaction.
-- The independently authorized operator must ALREADY possess the owner/lock
-- privileges on these tables. SHARE on redirects is NOT permitted by SELECT
-- alone. Missing privileges stop execution; this packet grants none.
lock table network.network_entities,network.network_entity_bindings in share row exclusive mode;
lock table network.network_entity_redirects in share mode;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml'
    or current_setting('v23.binding_retirement_authorized',true) is distinct from 'true' then
   raise exception 'Separate isolated binding retirement authorization required'; end if;
 if to_regclass('pg_temp.v23_closeout_identity') is null
    or to_regclass('pg_temp.v23_closeout_research') is null then
   raise exception 'Same-session teardown preservation baseline required'; end if;
 if (select count(*) from pg_temp.v23_closeout_identity)<>1
    or exists(select 1 from pg_temp.v23_closeout_identity where
      binding_before->>'id' is distinct from current_setting('v23.binding_id',true)
      or entity_before->>'id' is distinct from current_setting('v23.network_entity_id',true)
      or binding_before->>'provenance_ref' is distinct from current_setting('v23.binding_provenance_ref',true)) then
   raise exception 'Forward IDs/provenance differ from closeout baseline'; end if;
end $$;
set local role myth_identity_governor;
set local row_security=on;
do $$
declare b network.network_entity_bindings%rowtype; e network.network_entities%rowtype;
 retired_at timestamptz:=clock_timestamp(); affected integer;
begin
 select * into strict e from network.network_entities
   where id=nullif(current_setting('v23.network_entity_id',true),'')::uuid for update;
 select * into strict b from network.network_entity_bindings
   where id=nullif(current_setting('v23.binding_id',true),'')::uuid for update;
 if (b.network_entity_id,b.hub,b.specialist_entity_type,b.specialist_entity_id,b.identifier_namespace,
     b.source_identifier,b.source_identifier_normalized,b.jurisdiction,b.binding_status,b.provenance_ref)
   is distinct from (e.id,'move','mover','usdot-1002530','fmcsa.usdot','1002530','1002530','US','accepted',
     nullif(current_setting('v23.binding_provenance_ref',true),''))
   or b.valid_to is not null or b.valid_from>=retired_at then
   raise exception 'Exact live forward binding required'; end if;
 if (e.entity_type,e.canonical_name,e.primary_hub,e.jurisdiction,e.status,e.canonical_public_profile_ref)
   is distinct from ('organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US','active',
     '/companies/hindman-isaacs-moving-storage-inc') then
   raise exception 'Exact active forward canonical entity required'; end if;
 if exists(select 1 from network.network_entity_bindings other where other.id<>b.id and
   (other.network_entity_id=e.id or other.hub='move' and other.specialist_entity_id='usdot-1002530'
    or other.identifier_namespace='fmcsa.usdot' and other.source_identifier_normalized='1002530')) then
   raise exception 'Ambiguous binding or other use of canonical entity; steward review required'; end if;
 if exists(select 1 from network.network_entities other where other.id<>e.id and other.primary_hub='move'
   and (other.canonical_name=e.canonical_name or other.canonical_public_profile_ref=e.canonical_public_profile_ref)) then
   raise exception 'Competing canonical Move identity'; end if;
 if exists(select 1 from network.network_entity_redirects where from_entity_id=e.id or to_entity_id=e.id) then
   raise exception 'Redirected identity cannot be retired by this packet'; end if;
 update network.network_entity_bindings set valid_to=retired_at where id=b.id and network_entity_id=e.id;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Retirement must affect exactly one binding'; end if;
 update network.network_entities set status='retired' where id=e.id;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Retirement must affect exactly one entity'; end if;
 perform set_config('v23.closeout_retired_at',retired_at::text,true);
end $$;
reset role;
-- Only a successful operation writes this same-session postcondition witness.
create temp table v23_closeout_retirement on commit preserve rows as
 select current_setting('v23.binding_id')::uuid binding_id,
   current_setting('v23.network_entity_id')::uuid network_entity_id,
   current_setting('v23.closeout_retired_at')::timestamptz retired_at;
revoke all on pg_temp.v23_closeout_retirement from public,anon,authenticated;
commit;
-- A failure requires ROLLBACK and steward review, never a fallback DELETE.
-- Reopening the historical lifetime is a separate reviewed operation, not an
-- automatic inverse: intervening identities/lifetimes must be reconsidered.
