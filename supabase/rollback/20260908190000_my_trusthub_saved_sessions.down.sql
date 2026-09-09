-- Roll back P18 only. P11-P17 identity, research, handoff, Watch, source,
-- Alert, and notification foundations remain intact.
begin;

update ops.consumer_hub_registry
set allowed_scopes=array_remove(array_remove(allowed_scopes,'session:read'),'session:write');

revoke execute on function ops.create_session_resume_handoff(text,uuid,uuid,text,text,text,text) from myth_handoff_broker;
revoke execute on function ops.consume_session_resume_handoff(text,uuid,text,text,text)
from myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

revoke execute on function network.propose_consumer_session_schema(text,integer,text,text,integer,text[],text[],text[],text,text,text,text,text)
from myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
revoke execute on function network.set_consumer_session_schema_status(text,integer,text),
  network.register_consumer_session_schema_migration(uuid,uuid,text,text) from myth_session_governor;
revoke select on network.consumer_session_schemas,network.consumer_session_schema_migrations from myth_session_governor;

revoke execute on function consumer.save_session(text,text,text,integer,jsonb,jsonb,uuid,uuid,text),
  consumer.update_saved_session(uuid,text,integer,jsonb,jsonb,bigint,uuid),
  consumer.add_saved_session_to_project(uuid,uuid,uuid),
  consumer.remove_saved_session_from_project(uuid,uuid,uuid),
  consumer.archive_saved_session(uuid,bigint,uuid),consumer.restore_saved_session(uuid,bigint,uuid),
  consumer.remove_saved_session(uuid,bigint,uuid),consumer.mark_saved_session_resumed(uuid,bigint,uuid),
  consumer.apply_saved_session_schema_migration(uuid,text,integer,jsonb,jsonb,bigint,uuid),
  consumer.get_saved_session_for_resume(uuid),consumer.list_saved_session_summaries(integer),
  consumer.list_continue_sessions(integer),consumer.preview_guest_session_import(jsonb),
  consumer.commit_guest_session_import(jsonb,text[],uuid,uuid)
from authenticated,myth_consumer_api;

drop function if exists consumer.commit_guest_session_import(jsonb,text[],uuid,uuid);
drop function if exists consumer.preview_guest_session_import(jsonb);
drop function if exists consumer.validate_guest_session_payload(jsonb);
drop function if exists ops.consume_session_resume_handoff(text,uuid,text,text,text);
drop function if exists ops.create_session_resume_handoff(text,uuid,uuid,text,text,text,text);
drop function if exists consumer.list_continue_sessions(integer);
drop function if exists consumer.list_saved_session_summaries(integer);
drop function if exists consumer.get_saved_session_for_resume(uuid);
drop function if exists consumer.apply_saved_session_schema_migration(uuid,text,integer,jsonb,jsonb,bigint,uuid);
drop function if exists consumer.mark_saved_session_resumed(uuid,bigint,uuid);
drop function if exists consumer.remove_saved_session(uuid,bigint,uuid);
drop function if exists consumer.restore_saved_session(uuid,bigint,uuid);
drop function if exists consumer.archive_saved_session(uuid,bigint,uuid);
drop function if exists consumer.remove_saved_session_from_project(uuid,uuid,uuid);
drop function if exists consumer.add_saved_session_to_project(uuid,uuid,uuid);
drop function if exists consumer.update_saved_session(uuid,text,integer,jsonb,jsonb,bigint,uuid);
drop function if exists consumer.save_session(text,text,text,integer,jsonb,jsonb,uuid,uuid,text);
drop function if exists network.register_consumer_session_schema_migration(uuid,uuid,text,text);
drop function if exists network.set_consumer_session_schema_status(text,integer,text);
drop function if exists network.propose_consumer_session_schema(text,integer,text,text,integer,text[],text[],text[],text,text,text,text,text);
drop trigger if exists consumer_project_saved_sessions_ownership on consumer.consumer_project_saved_sessions;
drop function if exists consumer.enforce_saved_session_membership_ownership();
drop function if exists consumer.validate_saved_session_content(text,text,text,integer,jsonb,jsonb,boolean);
drop function if exists consumer.assert_session_actor(text,text);
drop function if exists consumer.session_json_has_prohibited_content(jsonb);

drop table if exists consumer.consumer_guest_session_import_items;
drop table if exists consumer.consumer_guest_session_imports;
drop table if exists ops.consumer_session_resume_handoffs;
drop table if exists consumer.consumer_session_events;
drop table if exists consumer.consumer_project_saved_sessions;
drop table if exists consumer.consumer_saved_sessions;
drop table if exists network.consumer_session_schema_migrations;
drop table if exists network.consumer_session_schemas;

revoke usage on schema network from myth_session_governor,myth_bff_move,myth_bff_lender,
  myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
comment on role myth_session_governor is
  'Reserved parent session-governance role; P18 is not installed.';

commit;
