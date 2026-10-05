-- MY TRUSTHUB V2 — CONTRACTOR DBPR BINDING ROLLBACK (operator).
-- Packet 16. Supply ONE forward receipt row per execution. Repeat once for
-- each receipt row that should be closed. Do not load a set. Do not drop the
-- resolver. This closes the validity window only. Saved research is preserved.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23contractor.external_key','<DBPR external_key>',false);
--   select set_config('v23contractor.binding_id','<binding_id>',false);
--   select set_config('v23contractor.network_entity_id','<network_entity_id>',false);
--   select set_config('v23contractor.canonical_public_profile_ref','<canonical_public_profile_ref>',false);
--
-- Closes the validity window of that exact binding. Does not retire the
-- network entity. Does not modify consumer.consumer_saved_entities.

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$
declare
  external_key text := btrim(coalesce(current_setting('v23contractor.external_key', true), ''));
  profile_ref text := btrim(coalesce(current_setting('v23contractor.canonical_public_profile_ref', true), ''));
  binding_id uuid;
  entity_id uuid;
  affected integer;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if (external_key, profile_ref) not in (
    ('CCC057187', '/contractors/ccc057187-a-r-roofing-inc'),
    ('CFC1427249', '/contractors/cfc1427249-a-sunny-plumbing-company'),
    ('CGC1506243', '/contractors/cgc1506243-abs-contracting-inc')
  ) then
    raise exception 'Supply one forward receipt row: DBPR key and canonical profile ref must be the same canary';
  end if;
  begin
    binding_id := btrim(current_setting('v23contractor.binding_id', true))::uuid;
    entity_id := btrim(current_setting('v23contractor.network_entity_id', true))::uuid;
  exception when invalid_text_representation then
    raise exception 'Supply one forward receipt row: binding_id and network_entity_id must be the returned uuids';
  end;
  update network.network_entity_bindings b
     set valid_to = clock_timestamp()
    from network.network_entities e
   where b.network_entity_id = e.id
     and b.id = binding_id
     and e.id = entity_id
     and b.source_identifier = external_key
     and b.jurisdiction = 'FL'
     and e.canonical_public_profile_ref = profile_ref
     and b.hub = 'contractor'
     and b.identifier_namespace = 'fl.dbpr.license'
     and b.specialist_entity_type = 'contractor_profile'
     and b.specialist_entity_id = 'fl.dbpr.license:' || external_key
     and b.valid_to is null;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Rollback must close exactly one binding from the supplied receipt row, closed %', affected;
  end if;
end $$;
commit;
