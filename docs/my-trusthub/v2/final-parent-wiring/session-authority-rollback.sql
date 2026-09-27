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
alter function v23_private.preview_session_live(uuid,uuid) owner to myth_v23_foundation;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;
commit;

-- The function above is already committed. This second transaction only attempts
-- the managed-schema grant. If it fails, the function restore remains and the
-- branch is back in the known failing state. Do not use supabase_admin to force it.
begin;
do $$ begin
  execute 'grant select(id,user_id,not_after) on auth.sessions to myth_v23_foundation';
  if not exists (select 1 from pg_policy where polname='preview_exact_live_session') then
    execute $pol$create policy preview_exact_live_session on auth.sessions for select to myth_v23_foundation
      using (id::text=current_setting('v23.session_id',true) and user_id::text=current_setting('v23.session_subject',true))$pol$;
  end if;
exception when insufficient_privilege then
  raise exception 'preview_session_live now reads auth.sessions, but SELECT could not be granted. This is the known failing state; do not use supabase_admin to force it.';
end $$;
commit;
