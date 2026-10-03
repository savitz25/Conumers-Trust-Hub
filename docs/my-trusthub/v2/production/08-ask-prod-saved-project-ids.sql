-- MY TRUSTHUB V2 PRODUCTION — SAVED PROJECT IDS READ MODEL (FORWARD, operator).
-- Target qvvxvbcdmbjzrgvwjatw. Independent of 00..07 and of the canary flag.
--
-- Replaces ONE function body: consumer.list_saved_entities(). Same signature,
-- SECURITY DEFINER, search_path and grants. No table, policy, role or data
-- change. Identical to supabase/migrations/20261003170000_my_trusthub_saved_project_ids.sql.
--
-- Defect: the aggregate filtered only on m.removed_at IS NULL, so a Saved entity
-- with no Project membership returned project_ids = {NULL} (length 1) instead
-- of {}. /my/saved then showed "1 Projects" and hid Unsave.
--
-- Rollback: re-run the function definition from
-- supabase/migrations/20260907190000_my_trusthub_saved_projects_guest_import.sql.
begin;
do $$
begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if to_regprocedure('consumer.list_saved_entities()') is null then
    raise exception 'SAVED_PROJECT_IDS_PRECONDITION_FAIL: consumer.list_saved_entities() missing';
  end if;
end $$;

create or replace function consumer.list_saved_entities()
returns table (
  saved_entity_id uuid,
  stored_network_entity_id uuid,
  resolved_network_entity_id uuid,
  canonical_name text,
  primary_hub text,
  identity_resolution_state text,
  saved_at timestamptz,
  removed_at timestamptz,
  project_ids uuid[]
)
language sql
stable
security definer
set search_path = pg_catalog, network, consumer
as $$
  select s.id, s.network_entity_id, terminal.id, terminal.canonical_name,
    terminal.primary_hub, s.identity_resolution_state, s.saved_at, s.removed_at,
    coalesce(
      array_agg(m.project_id order by m.project_id)
        filter (where m.project_id is not null and m.removed_at is null),
      array[]::uuid[])
  from consumer.consumer_saved_entities s
  join network.network_entities terminal on terminal.id = network.resolve_canonical_entity(s.network_entity_id)
  left join consumer.consumer_project_saved_entities m on m.saved_entity_id = s.id
  where s.user_id = consumer.require_user()
  group by s.id, terminal.id, terminal.canonical_name, terminal.primary_hub
  order by s.saved_at desc;
$$;

revoke all on function consumer.list_saved_entities() from public;
grant execute on function consumer.list_saved_entities() to authenticated;

-- Verification (read-only). Expected: one row, patched = true, definer = true,
-- authenticated = true, anon = false.
select position('m.project_id is not null' in pg_get_functiondef(p.oid)) > 0 as patched,
  p.prosecdef as definer,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'consumer' and p.proname = 'list_saved_entities';
commit;
