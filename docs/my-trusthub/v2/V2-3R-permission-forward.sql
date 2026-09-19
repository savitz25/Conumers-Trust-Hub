-- UNAPPLIED REVIEW PROPOSAL, not an auto-discovered migration.
-- Requires P11/P12/P13 and V2-3-parent-storage-proposal.sql. This narrow consumer
-- capability does NOT solve broker/staging authorization; do not wire a pool yet.
begin;
-- Deliberately fail if this role exists: never silently change a recovered role.
create role myth_v23_receipt_consumer nologin noinherit nosuperuser nocreatedb
  nocreaterole noreplication nobypassrls;
grant usage on schema consumer,ops,auth to myth_v23_receipt_consumer;
grant execute on function auth.uid() to myth_v23_receipt_consumer;
grant execute on function consumer.require_user() to myth_v23_receipt_consumer;
grant execute on function consumer.save_entity(uuid,text,jsonb) to myth_v23_receipt_consumer;
grant execute on function consumer.add_saved_entity_to_project(uuid,uuid,text) to myth_v23_receipt_consumer;
-- Existing P12 SECURITY DEFINER routines validate owner explicitly. No new
-- definer or BYPASSRLS function; no direct Saved/Project/notes mutation privilege.
grant select,insert,update on ops.v23_profile_runtime_records to myth_v23_receipt_consumer;
alter table ops.v23_profile_runtime_records enable row level security;
alter table ops.v23_profile_runtime_records force row level security;
create policy v23_receipt_consumer on ops.v23_profile_runtime_records
  for all to myth_v23_receipt_consumer
  using (kind='receipt' and payload->>'owner'=(select auth.uid())::text)
  with check (kind='receipt' and payload->>'owner'=(select auth.uid())::text);
-- No login membership, credential, broker grant, table ownership, public-schema
-- exposure or inherited authenticated/service_role membership is granted.
-- Only a verified parent service may establish transaction Auth claims using
-- already-approved channel authority. Never accept browser-supplied claims.
commit;
