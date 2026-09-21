-- Read-only catalog assertions after applying V2-3 on the approved isolated ref.
-- Run as the actual NON-SUPERUSER hosted migration executor, never service_role.
do $$
declare p record;
begin
  if (select rolsuper from pg_roles where rolname=current_user) then
    raise exception 'Hosted assertions require the actual non-superuser executor';
  end if;
  if (select count(*) from pg_roles where rolname like 'myth_v23_%')<>5
    or exists(select 1 from pg_roles where rolname like 'myth_v23_%'
      and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication))
    then raise exception 'V2-3 role attributes'; end if;
  if pg_has_role(current_user,'myth_v23_foundation','SET')
    or pg_has_role(current_user,'myth_v23_foundation','USAGE')
    then raise exception 'Executor retains effective foundation SET/INHERIT'; end if;
  if exists(select 1 from pg_auth_members where roleid='myth_v23_foundation'::regrole
    and member=current_user::regrole and grantor=current_user::regrole)
    then raise exception 'Temporary self membership remains'; end if;
  if has_schema_privilege('myth_v23_foundation','v23_private','CREATE')
    then raise exception 'Foundation retains CREATE'; end if;
  for p in select * from pg_proc where oid in (
    'v23_private.save_profile(uuid)'::regprocedure,
    'v23_private.add_project(uuid,uuid)'::regprocedure,
    'v23_private.consume_context(jsonb)'::regprocedure
  ) loop
    if p.proowner<>'myth_v23_foundation'::regrole or not p.prosecdef then
      raise exception 'Wrong wrapper owner/security: %',p.proname;
    end if;
    if not has_function_privilege('myth_v23_executor',p.oid,'EXECUTE') then
      raise exception 'Missing executor wrapper grant';
    end if;
    if exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee not in ('myth_v23_foundation'::regrole,'myth_v23_executor'::regrole)
        or a.privilege_type<>'EXECUTE'
        or (a.grantee='myth_v23_executor'::regrole and a.is_grantable)) then
      raise exception 'Unexpected wrapper ACL: %',p.proname;
    end if;
  end loop;
  if has_function_privilege('myth_v23_executor','consumer.save_entity(uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('myth_v23_executor','consumer.add_saved_entity_to_project(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('myth_v23_executor','ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text)','EXECUTE')
    then raise exception 'Executor bypasses scoped wrappers'; end if;
  if has_schema_privilege('anon','v23_private','USAGE')
    or has_schema_privilege('authenticated','v23_private','USAGE')
    then raise exception 'Browser private schema access'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and (n.nspname='v23_private'
        or (n.nspname='ops' and c.relname in ('v23_profile_runtime_records','v23_profile_runtime_quota')))
        and c.relrowsecurity and c.relforcerowsecurity)<>6 then
    raise exception 'All six V2-3 tables must ENABLE/FORCE RLS';
  end if;
end $$;
select 'PASS' as hosted_catalog_security;
