-- MY TRUSTHUB V2 — LENDER NMLS BINDING ROLLBACK (operator).
-- Closes the validity window of one exact binding. Does not delete the entity
-- or any Saved research row. A closed binding is no longer eligible.
-- Replace the two ids with the values returned by the forward packet.

begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
end $$;

update network.network_entity_bindings
   set valid_to = clock_timestamp()
 where id = '00000000-0000-4000-8000-000000000000'::uuid
   and network_entity_id = '00000000-0000-4000-8000-000000000000'::uuid
   and hub = 'lender'
   and identifier_namespace = 'nmls'
   and specialist_entity_type = 'marketplace_company'
   and valid_to is null;
commit;
