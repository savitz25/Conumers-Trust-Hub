-- MY TRUSTHUB V2 PRODUCTION HANDOFF — ASK READINESS (READ-ONLY, operator).
-- Target qvvxvbcdmbjzrgvwjatw. Run after 01..05 (and 03 when needed) and after
-- the runtime login password is set. Requires the single marker below; the
-- application repeats the same contract through prod_ports_ready() on every
-- request as myth_v23_authorizer.
do $$
declare ok boolean;
begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production readiness authorization required';
  end if;
  -- Exercise the runtime contract exactly as the application does.
  execute 'grant myth_v23_authorizer to current_user with admin false,inherit false,set true granted by current_user';
  execute 'set local role myth_v23_authorizer';
  execute 'select v23_private.prod_ports_ready()' into ok;
  execute 'reset role';
  execute 'revoke myth_v23_authorizer from current_user granted by current_user';
  if not coalesce(ok,false) then raise exception 'V23_PROD_PORTS_READY_FAIL'; end if;
  if (select count(*) from v23_private.prod_move_binding())<>1 then raise exception 'V23_PROD_BINDING_FAIL: exactly one accepted Hindman binding required'; end if;
  if not exists(select 1 from pg_roles where rolname='myth_v23_parent_prod' and rolcanlogin) then
    raise exception 'V23_PROD_LOGIN_FAIL: runtime login missing (04)';
  end if;
  -- The password itself is proven only by the application login (Vercel secret), never here.
  -- Outbound gate used by the application in production: no runtime role may reach schema net.
  if exists(select 1 from pg_namespace n where n.nspname='net' and (has_schema_privilege('myth_v23_parent_prod',n.oid,'USAGE')
      or has_schema_privilege('myth_v23_authorizer',n.oid,'USAGE') or has_schema_privilege('myth_v23_executor',n.oid,'USAGE')
      or exists(select 1 from pg_proc p where p.pronamespace=n.oid and (has_function_privilege('myth_v23_parent_prod',p.oid,'EXECUTE')
        or has_function_privilege('myth_v23_authorizer',p.oid,'EXECUTE') or has_function_privilege('myth_v23_executor',p.oid,'EXECUTE'))))) then
    raise exception 'V23_PROD_OUTBOUND_FAIL: a runtime role can reach schema net; revoke USAGE/EXECUTE on net.* from it';
  end if;
  raise notice 'V23_PROD_PARENT_READY_PASS';
end $$;
