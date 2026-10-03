-- MY TRUSTHUB V2 PRODUCTION — MOVE EXACT-USDOT RECONCILIATION (READ-ONLY, operator).
-- Target qvvxvbcdmbjzrgvwjatw. Requires 00..06 and 09 applied. One persistent
-- psql session, ON_ERROR_STOP=1, project pinned OUTSIDE SQL first, then:
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   \i 11-move-exact-usdot-candidates.sql
--   \i 11-ask-prod-move-exact-usdot-reconcile.sql
--
-- WHAT IT DOES: classifies every exact-USDOT Move candidate against the
-- network identity tables. It writes NO network or consumer row: it creates one
-- session-local temporary view, reads inside a READ ONLY transaction, and
-- records two session settings for the batch packet. Safe to run any number of
-- times.
--
-- Identity is the USDOT number only: `move` / `mover` / `fmcsa.usdot` / `US` /
-- `usdot-<number>`. No candidate is ever connected to an entity by name. The
-- legal name and profile ref are compared for ONE purpose only, the same one
-- packet 10 has: an existing Move entity carrying the same label holds the
-- candidate back for steward review.
--
-- Classes (first rule that matches):
--   AMBIGUOUS         two or more current bindings claim the identity (the
--                     resolver would return several rows)
--   ALREADY_ACCEPTED  exactly one current binding, exact governed identity,
--                     accepted, on an active entity (what the runtime admits)
--   REVIEW_REQUIRED   the one current binding is exact but review_required; or
--                     only ended / superseded / invalid bindings exist (a
--                     retired identity is never reopened here); or no binding
--                     exists but a Move entity already carries the same
--                     canonical name or profile ref
--   CONFLICT          the one current binding disagrees with the governed
--                     identity (other hub, class, native id, number or
--                     jurisdiction) or sits on an entity that is not active
--   SAFE_NEW_BINDING  no binding of any status or lifetime claims the native id
--                     or the fmcsa.usdot number, and no Move entity carries the
--                     candidate's canonical name or profile ref
-- "Current" is the resolver's own definition: accepted or review_required,
-- valid_from <= now, valid_to null or in the future.
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project'; end if;
  if to_regclass('pg_temp.v23bulk_candidates') is null then
    raise exception 'Load 11-move-exact-usdot-candidates.sql in this session first'; end if;
  if to_regprocedure('v23_private.prod_move_binding_for(text)') is null then
    raise exception 'V23_BULK_PRECONDITION_FAIL: 09-ask-prod-move-binding-resolver-forward.sql must be applied first'; end if;
  if (select count(*)::text from pg_temp.v23bulk_candidates) is distinct from current_setting('v23bulk.manifest_rows',true)
     or (select encode(sha256(convert_to(string_agg(usdot||'|'||slug||'|'||legal_name,E'\n' order by usdot::bigint),'UTF8')),'hex')
         from pg_temp.v23bulk_candidates) is distinct from current_setting('v23bulk.manifest_sha256',true) then
    raise exception 'V23_BULK_MANIFEST_FAIL: loaded candidates differ from the generated manifest'; end if;
end $$;

create or replace temp view v23bulk_classified with (security_invoker=true) as
with claims as (
  select c.usdot,b.id as binding_id,b.network_entity_id,b.binding_status,e.status as entity_status,
    (b.binding_status in ('accepted','review_required') and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())) as is_current,
    (b.hub='move' and b.specialist_entity_type='mover' and b.specialist_entity_id='usdot-'||c.usdot
      and b.identifier_namespace='fmcsa.usdot' and b.source_identifier=c.usdot and b.source_identifier_normalized=c.usdot
      and coalesce(b.jurisdiction,'')='US') as is_exact
  from (
    -- Two exact equality joins; UNION removes a binding matched by both.
    select c.usdot,b.id from pg_temp.v23bulk_candidates c
      join network.network_entity_bindings b on b.hub='move' and b.specialist_entity_id='usdot-'||c.usdot
    union
    select c.usdot,b.id from pg_temp.v23bulk_candidates c
      join network.network_entity_bindings b on b.identifier_namespace='fmcsa.usdot' and b.source_identifier_normalized=c.usdot
  ) c
  join network.network_entity_bindings b on b.id=c.id
  join network.network_entities e on e.id=b.network_entity_id
), per_candidate as (
  select usdot,count(*) as claims_total,count(*) filter (where is_current) as claims_current,
    coalesce(bool_and(is_exact) filter (where is_current),false) as current_exact,
    min(binding_status) filter (where is_current) as current_status,
    min(entity_status) filter (where is_current) as current_entity_status,
    array_agg(binding_id order by binding_id) as binding_ids,
    array_agg(distinct network_entity_id) as entity_ids
  from claims group by usdot
), labels as (
  select m.usdot,count(*) as label_entities,array_agg(m.id order by m.id) as label_entity_ids
  from (
    select c.usdot,e.id from pg_temp.v23bulk_candidates c
      join network.network_entities e on e.primary_hub='move' and lower(btrim(e.canonical_name))=lower(c.legal_name)
    union
    select c.usdot,e.id from pg_temp.v23bulk_candidates c
      join network.network_entities e on e.primary_hub='move' and e.canonical_public_profile_ref='/companies/'||c.slug
  ) m
  group by m.usdot
)
select c.usdot,c.slug,c.legal_name,
  case
    when coalesce(p.claims_current,0)>=2 then 'AMBIGUOUS'
    when p.claims_current=1 and p.current_exact and p.current_status='accepted' and p.current_entity_status='active' then 'ALREADY_ACCEPTED'
    when p.claims_current=1 and p.current_exact and p.current_status='review_required' and p.current_entity_status in ('active','review_required') then 'REVIEW_REQUIRED'
    when p.claims_current=1 then 'CONFLICT'
    when coalesce(p.claims_total,0)>0 then 'REVIEW_REQUIRED'
    when coalesce(l.label_entities,0)>0 then 'REVIEW_REQUIRED'
    else 'SAFE_NEW_BINDING'
  end as class,
  case
    when coalesce(p.claims_current,0)>=2 then 'several current bindings claim this identity'
    when p.claims_current=1 and p.current_exact and p.current_status='accepted' and p.current_entity_status='active' then 'one exact accepted binding on an active entity'
    when p.claims_current=1 and p.current_exact and p.current_status='review_required' and p.current_entity_status in ('active','review_required') then 'exact binding awaits steward review'
    when p.claims_current=1 and not p.current_exact then 'current binding disagrees with the governed identity'
    when p.claims_current=1 then 'current binding sits on an entity that is not active'
    when coalesce(p.claims_total,0)>0 then 'only ended, superseded or invalid bindings; retired identity is not reopened'
    when coalesce(l.label_entities,0)>0 then 'a Move entity already carries this canonical name or profile ref'
    else 'no binding and no entity for this identity'
  end as reason,
  coalesce(p.claims_total,0) as claims_total,coalesce(p.claims_current,0) as claims_current,
  p.binding_ids,p.entity_ids,l.label_entity_ids
from pg_temp.v23bulk_candidates c
left join per_candidate p using (usdot)
left join labels l using (usdot);

begin transaction read only;
set local statement_timeout='60s';
-- Statistics on the identity tables lag a bulk insert and a temporary table has
-- none; hash/merge joins keep the set classification fast regardless.
set local enable_nestloop=off;
-- Counts. Record these in the receipt.
select class,count(*) as candidates from pg_temp.v23bulk_classified group by class order by class;
-- Row-level evidence for everything the batch will NOT touch.
select class,usdot,slug,legal_name,reason,claims_total,claims_current,binding_ids,entity_ids,label_entity_ids
from pg_temp.v23bulk_classified where class not in ('SAFE_NEW_BINDING','ALREADY_ACCEPTED') order by class,usdot::bigint;
-- The Hindman reference must be ALREADY_ACCEPTED, or it is not this database.
do $$ begin
  if (select class from pg_temp.v23bulk_classified where usdot='1002530') is distinct from 'ALREADY_ACCEPTED' then
    raise exception 'V23_BULK_RECONCILE_FAIL: Hindman reference is not ALREADY_ACCEPTED'; end if;
end $$;
select set_config('v23bulk.reconciled_at',clock_timestamp()::text,false) as reconciled_at,
  set_config('v23bulk.reconciled_safe_new',(select count(*) from pg_temp.v23bulk_classified where class='SAFE_NEW_BINDING')::text,false) as safe_new_binding;
commit;
-- Full row-level export for the ledger (psql):
--   \copy (select class,usdot,slug,legal_name,reason,claims_total,claims_current,binding_ids,entity_ids,label_entity_ids from pg_temp.v23bulk_classified order by class,usdot::bigint) to '11-reconciliation-<date>.csv' csv header
-- Marker: the last result row shows reconciled_at and safe_new_binding.
