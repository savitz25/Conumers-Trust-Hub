-- MY TRUSTHUB V2 — SENIOR CMS CCN BINDING ROLLBACK (operator).
-- Packet 17. Supply ONE forward receipt row per execution. Repeat once for
-- each receipt row that should be closed. Do not load a set. Do not drop the
-- resolver. This closes the validity window only. Saved research is preserved.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23senior.ccn','<CCN>',false);
--   select set_config('v23senior.binding_id','<binding_id>',false);
--   select set_config('v23senior.network_entity_id','<network_entity_id>',false);
--   select set_config('v23senior.canonical_public_profile_ref','<canonical_public_profile_ref>',false);
--
-- Closes the validity window of that exact binding. Does not retire the
-- network entity. Does not modify consumer.consumer_saved_entities.

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$
declare
  ccn text := btrim(coalesce(current_setting('v23senior.ccn', true), ''));
  profile_ref text := btrim(coalesce(current_setting('v23senior.canonical_public_profile_ref', true), ''));
  binding_id uuid;
  entity_id uuid;
  affected integer;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if (ccn, profile_ref) not in (
    ('015009', '/facility/cms/015009/burns-nursing-home-inc'),
    ('055223', '/facility/cms/055223/san-jacinto-valley-post-acute'),
    ('155805', '/facility/cms/155805/addison-pointe-health-and-rehabilitation-center')
  ) then
    raise exception 'Supply one forward receipt row: CCN and canonical profile ref must be the same canary';
  end if;
  begin
    binding_id := btrim(current_setting('v23senior.binding_id', true))::uuid;
    entity_id := btrim(current_setting('v23senior.network_entity_id', true))::uuid;
  exception when invalid_text_representation then
    raise exception 'Supply one forward receipt row: binding_id and network_entity_id must be the returned uuids';
  end;
  update network.network_entity_bindings b
     set valid_to = clock_timestamp()
    from network.network_entities e
   where b.network_entity_id = e.id
     and b.id = binding_id
     and e.id = entity_id
     and b.source_identifier = ccn
     and b.jurisdiction = 'US'
     and e.canonical_public_profile_ref = profile_ref
     and b.hub = 'senior'
     and b.identifier_namespace = 'cms.ccn'
     and b.specialist_entity_type = 'cms_facility'
     and b.specialist_entity_id = ccn
     and b.valid_to is null;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Rollback must close exactly one binding from the supplied receipt row, closed %', affected;
  end if;
end $$;
commit;
