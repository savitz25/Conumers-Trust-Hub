-- MY TRUSTHUB V2 — INVESTOR FIRM CRD BINDING ROLLBACK (operator).
-- Supply ONE forward receipt row per execution. Repeat once for each receipt
-- row that should be closed. Do not load a set. Do not drop the resolver.
--
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23investor.crd','<crd>',false);
--   select set_config('v23investor.binding_id','<binding_id>',false);
--   select set_config('v23investor.network_entity_id','<network_entity_id>',false);
--   select set_config('v23investor.canonical_public_profile_ref','<canonical_public_profile_ref>',false);
--
-- Closes the validity window of that exact binding. Does not DELETE.
-- Does not retire the network entity. Does not modify
-- consumer.consumer_saved_entities. Saved research is preserved.
-- A closed binding is not returned by the resolver, so that firm stops being
-- eligible for an account Save. Running it twice for the same row closes
-- nothing the second time and raises.

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$
declare
  crd text := btrim(coalesce(current_setting('v23investor.crd', true), ''));
  profile_ref text := btrim(coalesce(current_setting('v23investor.canonical_public_profile_ref', true), ''));
  binding_id uuid;
  entity_id uuid;
  affected integer;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if (crd, profile_ref) not in (
    ('106176', '/firm/sec-crd-106176'),
    ('104571', '/firm/sec-crd-104571'),
    ('110441', '/firm/sec-crd-110441')
  ) then
    raise exception 'Supply one forward receipt row: CRD and canonical profile ref must be the same canary';
  end if;
  begin
    binding_id := btrim(current_setting('v23investor.binding_id', true))::uuid;
    entity_id := btrim(current_setting('v23investor.network_entity_id', true))::uuid;
  exception when invalid_text_representation then
    raise exception 'Supply one forward receipt row: binding_id and network_entity_id must be the returned uuids';
  end;
  update network.network_entity_bindings b
     set valid_to = clock_timestamp()
    from network.network_entities e
   where b.network_entity_id = e.id
     and b.id = binding_id
     and e.id = entity_id
     and b.source_identifier = crd
     and b.specialist_entity_id = 'crd-' || crd
     and e.canonical_public_profile_ref = profile_ref
     and b.hub = 'investor'
     and b.identifier_namespace = 'sec.crd'
     and b.specialist_entity_type = 'official_firm'
     and b.binding_status = 'accepted'
     and b.provenance_ref = 'investor_trust_hub_firms'
     and b.valid_to is null;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Rollback must close exactly one binding from the supplied receipt row, closed %', affected;
  end if;
end $$;
commit;
