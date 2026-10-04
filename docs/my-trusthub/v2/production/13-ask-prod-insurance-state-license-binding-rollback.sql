-- MY TRUSTHUB V2 — INSURANCE STATE-LICENSE BINDING ROLLBACK (operator).
-- Supply ONE forward receipt row per execution. Repeat once for each receipt
-- row that should be closed. Do not load a set. Do not drop the resolver.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23insurance.jurisdiction','<jurisdiction>',false);
--   select set_config('v23insurance.license','<license>',false);
--   select set_config('v23insurance.binding_id','<binding_id>',false);
--   select set_config('v23insurance.network_entity_id','<network_entity_id>',false);
--   select set_config('v23insurance.canonical_public_profile_ref','<canonical_public_profile_ref>',false);
--
-- Closes the validity window of that exact binding. Does not DELETE.
-- Does not retire the network entity. Does not modify
-- consumer.consumer_saved_entities. Saved research is preserved.
-- Does not modify legal_insurer / NAIC bindings.

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$
declare
  jurisdiction text := btrim(coalesce(current_setting('v23insurance.jurisdiction', true), ''));
  license text := btrim(coalesce(current_setting('v23insurance.license', true), ''));
  profile_ref text := btrim(coalesce(current_setting('v23insurance.canonical_public_profile_ref', true), ''));
  binding_id uuid;
  entity_id uuid;
  affected integer;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if (jurisdiction, license, profile_ref) not in (
    ('FL', 'L106287', '/providers/asfin-llc-l106287'),
    ('TX', '1365714', '/providers/imt-services-llc-1365714'),
    ('OH', '19068455', '/providers/j-a-sandoval-llc-19068455')
  ) then
    raise exception 'Supply one forward receipt row: state, license, and canonical profile ref must be the same canary';
  end if;
  begin
    binding_id := btrim(current_setting('v23insurance.binding_id', true))::uuid;
    entity_id := btrim(current_setting('v23insurance.network_entity_id', true))::uuid;
  exception when invalid_text_representation then
    raise exception 'Supply one forward receipt row: binding_id and network_entity_id must be the returned uuids';
  end;
  update network.network_entity_bindings b
     set valid_to = clock_timestamp()
    from network.network_entities e
   where b.network_entity_id = e.id
     and b.id = binding_id
     and e.id = entity_id
     and b.source_identifier = license
     and b.jurisdiction = jurisdiction
     and e.canonical_public_profile_ref = profile_ref
     and b.hub = 'insurance'
     and b.identifier_namespace = 'insurance.state_license'
     and b.specialist_entity_type = 'insurance_provider'
     and b.specialist_entity_id = 'state-license:' || jurisdiction || ':' || license
     and b.valid_to is null;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Rollback must close exactly one binding from the supplied receipt row, closed %', affected;
  end if;
end $$;
commit;
