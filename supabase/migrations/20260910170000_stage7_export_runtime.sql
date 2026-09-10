-- Stage 7 additive export runtime. Private bundles remain owner-gated and expire after seven days.
alter table ops.consumer_export_jobs add column if not exists artifact_bundle jsonb null;

create or replace function consumer.issue_workspace_deletion_confirmation()
returns text language plpgsql security definer
set search_path=pg_catalog,consumer,ops,extensions as $$
declare v_subject uuid:=consumer.require_user(); v_code text:=replace(gen_random_uuid()::text,'-','');
begin
  if not exists(select 1 from consumer.consumer_profiles where user_id=v_subject) then raise exception 'CONSUMER_WORKSPACE_NOT_FOUND' using errcode='no_data_found'; end if;
  insert into ops.consumer_destructive_confirmations(user_id,purpose,code_hash,expires_at)
  values(v_subject,'delete_consumer_workspace',encode(digest(v_code,'sha256'),'hex'),statement_timestamp()+interval '10 minutes');
  return v_code;
end; $$;
revoke all on function consumer.issue_workspace_deletion_confirmation() from public;
grant execute on function consumer.issue_workspace_deletion_confirmation() to authenticated;

create or replace function consumer.download_export(p_job_id uuid)
returns jsonb language sql stable security definer
set search_path=pg_catalog,consumer,ops as $$
  select case when j.status='completed' and j.expires_at>statement_timestamp() then j.artifact_bundle else null end
  from ops.consumer_export_jobs j where j.id=p_job_id and j.user_id=consumer.require_user()
$$;
revoke all on function consumer.download_export(uuid) from public;
grant execute on function consumer.download_export(uuid) to authenticated;

create or replace function ops.complete_consumer_export_job_with_bundle(
  p_job_id uuid,p_lease_token text,p_artifact_ref text
)
returns text language plpgsql security definer set search_path=pg_catalog,ops,extensions as $$
declare v_bundle jsonb; v_hash text;
begin
  perform ops.assert_export_job_lease(p_job_id,p_lease_token);
  if p_artifact_ref!~'^exports/[A-Za-z0-9/_-]{1,240}$' then raise exception 'EXPORT_ARTIFACT_REF_INVALID' using errcode='invalid_parameter_value'; end if;
  v_bundle:=ops.build_consumer_export_bundle(p_job_id,p_lease_token);
  v_hash:=encode(digest(v_bundle::text,'sha256'),'hex');
  update ops.consumer_export_jobs j set status='completed',completed_at=statement_timestamp(),
    expires_at=statement_timestamp()+interval '7 days',artifact_ref=p_artifact_ref,artifact_hash=v_hash,
    artifact_bundle=v_bundle,lease_token_hash=null,row_version=j.row_version+1 where j.id=p_job_id;
  return v_hash;
end; $$;
revoke all on function ops.complete_consumer_export_job_with_bundle(uuid,text,text) from public;

comment on column ops.consumer_export_jobs.artifact_bundle is 'Private owner-scoped export bundle; expires with the job and is never exposed through public storage.';

do $$ begin
  if not exists (select 1 from pg_roles where rolname='myth_export_worker') then create role myth_export_worker login; end if;
  if not exists (select 1 from pg_roles where rolname='myth_deletion_worker') then create role myth_deletion_worker login; end if;
end $$;
grant usage on schema ops to myth_export_worker, myth_deletion_worker;
grant select on ops.consumer_export_jobs to myth_export_worker;
grant select on ops.consumer_deletion_jobs, ops.consumer_deletion_steps to myth_deletion_worker;
grant execute on function ops.claim_consumer_export_job(uuid,text,text), ops.build_consumer_export_bundle(uuid,text), ops.complete_consumer_export_job_with_bundle(uuid,text,text), ops.fail_consumer_export_job(uuid,text,text) to myth_export_worker;
grant execute on function ops.claim_consumer_deletion_job(uuid,text,text), ops.run_consumer_deletion_step(uuid,text,text), ops.complete_consumer_deletion_job(uuid,text) to myth_deletion_worker;
