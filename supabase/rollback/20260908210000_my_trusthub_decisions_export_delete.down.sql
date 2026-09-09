-- Roll back P19 only. P11-P18 remain intact.
begin;

update ops.consumer_hub_registry set allowed_scopes=array_remove(allowed_scopes,'decision:read');

drop trigger if exists consumer_profiles_block_deleted_recreation on consumer.consumer_profiles;
drop trigger if exists consumer_deliveries_block_workspace_deletion on ops.consumer_alert_deliveries;
drop trigger if exists consumer_alerts_block_workspace_deletion on consumer.consumer_alerts;
drop trigger if exists consumer_alerts_capture_surfaced on consumer.consumer_alerts;
drop trigger if exists consumer_watches_capture_started on consumer.consumer_watches;
drop trigger if exists consumer_project_saved_sessions_capture_event on consumer.consumer_project_saved_sessions;
drop trigger if exists consumer_project_saved_entities_capture_event on consumer.consumer_project_saved_entities;
drop trigger if exists consumer_projects_capture_created on consumer.consumer_projects;

revoke execute on function consumer.get_specialist_decision_context(uuid,uuid,text)
from myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
revoke execute on function network.set_consumer_session_export_policy(text,integer,text,text[]) from myth_session_governor;
revoke execute on function ops.claim_consumer_export_job(uuid,text,text),
  ops.build_consumer_export_bundle(uuid,text),ops.complete_consumer_export_job(uuid,text,text),
  ops.fail_consumer_export_job(uuid,text,text) from myth_export_worker;
revoke execute on function ops.issue_consumer_destructive_confirmation(uuid,text),
  ops.claim_consumer_deletion_job(uuid,text,text),ops.run_consumer_deletion_step(uuid,text,text),
  ops.complete_consumer_deletion_job(uuid,text) from myth_deletion_worker;

drop function if exists ops.block_deleted_workspace_recreation();
drop function if exists ops.block_delivery_during_workspace_deletion();
drop function if exists ops.block_alert_during_workspace_deletion();
drop function if exists ops.complete_consumer_deletion_job(uuid,text);
drop function if exists ops.run_consumer_deletion_step(uuid,text,text);
drop function if exists ops.assert_deletion_job_lease(uuid,text);
drop function if exists ops.claim_consumer_deletion_job(uuid,text,text);
drop function if exists consumer.get_workspace_deletion_status(uuid);
drop function if exists consumer.cancel_workspace_deletion(uuid);
drop function if exists consumer.request_workspace_deletion(text,uuid);
drop function if exists ops.issue_consumer_destructive_confirmation(uuid,text);
drop function if exists ops.fail_consumer_export_job(uuid,text,text);
drop function if exists ops.complete_consumer_export_job(uuid,text,text);
drop function if exists ops.build_consumer_export_bundle(uuid,text);
drop function if exists ops.assert_export_job_lease(uuid,text);
drop function if exists ops.claim_consumer_export_job(uuid,text,text);
drop function if exists consumer.get_export_status(uuid);
drop function if exists consumer.request_export(uuid);
drop function if exists network.set_consumer_session_export_policy(text,integer,text,text[]);
drop function if exists consumer.capture_alert_surfaced_events();
drop function if exists consumer.capture_watch_started_events();
drop function if exists consumer.capture_session_membership_event();
drop function if exists consumer.capture_saved_membership_event();
drop function if exists consumer.capture_project_created_event();
drop function if exists consumer.get_specialist_decision_context(uuid,uuid,text);
drop function if exists consumer.get_research_snapshot(uuid);
drop function if exists consumer.list_project_decisions(uuid);
drop function if exists consumer.reopen_project(uuid,bigint,uuid);
drop function if exists consumer.complete_project(uuid,uuid,bigint,uuid);
drop function if exists consumer.verify_research_snapshot(uuid);
drop function if exists consumer.record_project_decision(uuid,text,text,jsonb,uuid);
drop function if exists consumer.build_project_research_snapshot(uuid,uuid);

drop table if exists ops.consumer_deletion_steps;
drop table if exists ops.consumer_deletion_jobs;
drop table if exists ops.consumer_destructive_confirmations;
drop table if exists ops.consumer_export_jobs;
drop table if exists consumer.consumer_project_events;
drop table if exists consumer.consumer_research_snapshots;
drop table if exists consumer.consumer_project_decision_entities;
drop table if exists consumer.consumer_project_decisions;

drop function if exists consumer.reject_snapshot_update();
drop function if exists consumer.enforce_decision_selection_ownership();
drop function if exists consumer.enforce_decision_append_only();

alter table network.consumer_session_schemas
  drop column if exists export_redacted_keys,
  drop column if exists export_policy;

create or replace function consumer.archive_project(p_project_id uuid, p_expected_row_version bigint)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); next_version bigint;
begin
  update consumer.consumer_projects p
  set status = 'archived', archived_at = statement_timestamp(), row_version = p.row_version + 1
  where p.id = p_project_id and p.user_id = subject
    and p.status = 'active' and p.row_version = p_expected_row_version
  returning p.row_version into next_version;
  if next_version is null then
    raise exception 'active Project not found or stale row version' using errcode = 'serialization_failure';
  end if;
  return next_version;
end;
$$;
revoke all on function consumer.archive_project(uuid,bigint) from public;
grant execute on function consumer.archive_project(uuid,bigint) to authenticated;

create or replace function consumer.restore_project(p_project_id uuid, p_expected_row_version bigint)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); next_version bigint;
begin
  update consumer.consumer_projects p
  set status = 'active', archived_at = null, completed_at = null, row_version = p.row_version + 1
  where p.id = p_project_id and p.user_id = subject
    and p.status = 'archived' and p.row_version = p_expected_row_version
  returning p.row_version into next_version;
  if next_version is null then
    raise exception 'archived Project not found or stale row version' using errcode = 'serialization_failure';
  end if;
  return next_version;
end;
$$;
revoke all on function consumer.restore_project(uuid,bigint) from public;
grant execute on function consumer.restore_project(uuid,bigint) to authenticated;

comment on role myth_export_worker is 'Reserved least-privilege P19 role; no P11B data privileges.';
comment on role myth_deletion_worker is 'Reserved least-privilege P19 role; no P11B data privileges.';

commit;
