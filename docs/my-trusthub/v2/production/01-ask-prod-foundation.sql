-- MY TRUSTHUB V2 PRODUCTION HANDOFF — ASK FOUNDATION.
-- Target: qvvxvbcdmbjzrgvwjatw, database postgres. Operator session only.
-- Order inside this packet (one persistent psql/SQL session, ON_ERROR_STOP):
--   1. docs/my-trusthub/v2/V2-3-parent-storage-proposal.sql            (verbatim)
--   2. supabase/migrations/20260919205200_my_trusthub_v23_transaction_capability.sql (verbatim)
--   3. this file (production copies of V2-3F wrapper ACL repair + V2-3R receipt consumer)
-- Steps 1 and 2 carry no project guard and are identical to the isolated apply.
-- Record 20260919205200 in the production migration ledger after step 2.
begin;
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production apply authorization required (set v23.approved_project)';
  end if;
  if to_regnamespace('v23_private') is null or to_regclass('ops.v23_profile_runtime_records') is null
     or to_regprocedure('v23_private.save_profile(uuid)') is null then
    raise exception 'Steps 1 and 2 (storage proposal + 20260919205200) must be applied first';
  end if;
end $$;

-- V2-3F wrapper ACL repair (production copy). Same statements as the isolated repair.
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
revoke all on function v23_private.save_profile(uuid) from public;
grant execute on function v23_private.save_profile(uuid) to myth_v23_executor;
revoke all on function v23_private.add_project(uuid,uuid) from public;
grant execute on function v23_private.add_project(uuid,uuid) to myth_v23_executor;
revoke all on function v23_private.consume_context(jsonb) from public;
grant execute on function v23_private.consume_context(jsonb) to myth_v23_executor;
reset role;
revoke myth_v23_foundation from current_user granted by current_user;

-- V2-3R receipt consumer (production copy). Deliberately fails if the role exists.
create role myth_v23_receipt_consumer nologin noinherit nosuperuser nocreatedb
  nocreaterole noreplication nobypassrls;
grant usage on schema consumer,ops,auth to myth_v23_receipt_consumer;
grant execute on function auth.uid() to myth_v23_receipt_consumer;
grant execute on function consumer.require_user() to myth_v23_receipt_consumer;
grant execute on function consumer.save_entity(uuid,text,jsonb) to myth_v23_receipt_consumer;
grant execute on function consumer.add_saved_entity_to_project(uuid,uuid,text) to myth_v23_receipt_consumer;
grant select,insert,update on ops.v23_profile_runtime_records to myth_v23_receipt_consumer;
alter table ops.v23_profile_runtime_records enable row level security;
alter table ops.v23_profile_runtime_records force row level security;
create policy v23_receipt_consumer on ops.v23_profile_runtime_records
  for all to myth_v23_receipt_consumer
  using (kind='receipt' and payload->>'owner'=(select auth.uid())::text)
  with check (kind='receipt' and payload->>'owner'=(select auth.uid())::text);

-- Hosted catalog assertions (same as the isolated V2-3F gate): no login, no
-- broad privilege, no public execute on the wrappers.
do $$ begin
  if exists(select 1 from pg_roles where rolname in ('myth_v23_authorizer','myth_v23_executor','myth_v23_foundation','myth_v23_cleanup','myth_v23_browser_store','myth_v23_receipt_consumer')
            and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication)) then
    raise exception 'V23_PROD_FOUNDATION_FAIL: a v23 role carries login or broad privilege';
  end if;
  if has_function_privilege('public','v23_private.save_profile(uuid)','EXECUTE')
     or has_function_privilege('public','v23_private.add_project(uuid,uuid)','EXECUTE')
     or has_function_privilege('public','v23_private.consume_context(jsonb)','EXECUTE') then
    raise exception 'V23_PROD_FOUNDATION_FAIL: wrapper still executable by PUBLIC';
  end if;
  raise notice 'V23_PROD_FOUNDATION_PASS';
end $$;
commit;
