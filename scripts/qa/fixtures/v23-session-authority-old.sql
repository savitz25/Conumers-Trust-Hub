-- Exact old installed function/ACL definitions from bce29118. Disposable fixture only.
create function v23_private.preview_session_live(subject uuid,session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,auth as $$
begin
 perform set_config('v23.session_id',session::text,true);
 perform set_config('v23.session_subject',subject::text,true);
 return exists(select 1 from auth.sessions s where s.id=session and s.user_id=subject
   and (s.not_after is null or s.not_after>statement_timestamp()));
end;
$$;
revoke all on function v23_private.preview_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.preview_session_live(uuid,uuid) to myth_v23_authorizer,myth_v23_executor;

create function v23_private.preview_ports_ready() returns boolean
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
