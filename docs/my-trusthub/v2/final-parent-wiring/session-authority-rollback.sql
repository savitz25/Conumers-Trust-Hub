-- ROLLBACK for session-authority-forward.sql. Do not apply from an agent session.
-- Restores the previous auth.sessions predicate. That predicate needs SELECT on
-- auth.sessions, which the isolated operator cannot grant. Rollback therefore
-- returns the branch to the current failing state; it is not a working alternative.
-- Target remains xkkiicsassizmakcvxml. Production is out of scope.
begin;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'xkkiicsassizmakcvxml' then
    raise exception 'Explicit isolated apply authorization required';
  end if;
  if (select project_ref from v23_private.preview_deployment_pin where singleton) is distinct from 'xkkiicsassizmakcvxml' then
    raise exception 'Deployment pin is not the isolated Ask project';
  end if;
end $$;

grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false, inherit false, set true granted by current_user;
set local role myth_v23_foundation;
drop function if exists v23_private.preview_session_authority_ready();
drop function if exists v23_private.preview_session_bind(uuid,uuid,bigint,bytea);
drop function if exists v23_private.preview_session_install_mac(bytea);
drop function if exists v23_private.preview_session_mac_matches(text,bytea,bytea);
drop table if exists v23_private.preview_session_attestations;
drop table if exists v23_private.preview_session_mac;

create or replace function v23_private.preview_session_live(subject uuid, session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,auth as $$
begin
  perform set_config('v23.session_id', session::text, true);
  perform set_config('v23.session_subject', subject::text, true);
  return exists(select 1 from auth.sessions s where s.id=session and s.user_id=subject
    and (s.not_after is null or s.not_after>statement_timestamp()));
end $$;
revoke all on function v23_private.preview_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_session_live(uuid,uuid) to myth_v23_authorizer,myth_v23_executor;
reset role;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;
create or replace function v23_private.preview_ports_ready() returns boolean
language sql stable security invoker set search_path=pg_catalog as $$
 select current_user='myth_v23_authorizer'
 and not exists(select 1 from unnest(array[
  'v23_private.preview_confirmation(text,text,jsonb)',
  'v23_private.preview_session_live(uuid,uuid)',
  'v23_private.preview_move_binding()',
  'v23_private.preview_projects(uuid,uuid)',
  'v23_private.preview_saved(uuid,uuid)',
  'v23_private.preview_issue_context(jsonb,uuid,uuid)']) f
  where to_regprocedure(f) is null or not has_function_privilege(current_user,f,'EXECUTE'))
 and (select count(*)=5 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname||'.'||c.relname in ('v23_private.preview_transport_records','v23_private.browser_confirmations',
  'v23_private.transaction_authority','ops.v23_profile_runtime_records','ops.v23_profile_runtime_quota')
  and c.relrowsecurity and c.relforcerowsecurity)
 and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='auth' and c.relname in ('users','sessions') and has_table_privilege(current_user,c.oid,'SELECT'));
$$;
revoke all on function v23_private.preview_ports_ready() from public,anon,authenticated;
grant execute on function v23_private.preview_ports_ready() to myth_v23_authorizer;
commit;


-- Intentionally no managed Auth grants/policies: restored predicate remains HOLD.
