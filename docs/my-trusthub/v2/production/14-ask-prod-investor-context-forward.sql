-- MY TRUSTHUB V2 — INVESTOR ACCOUNT-CONTEXT ISSUER (FORWARD, operator).
-- NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw. Requires 00..06.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- WHY: v23_private.prod_issue_context() always issues the one-time account
-- context as hub 'move' from the Move origin. The Save commit then consumes it
-- as the hub of the verified caller, so a context issued for 'move' is refused
-- (INVALID_AUDIENCE) for an Investor Save. This adds the Investor issuer.
--
-- WHAT CHANGES: one new function. It is prod_issue_context() with the issuer
-- hub 'investor' and the pinned origin https://www.investortrusthub.com in
-- place of 'move' and the Move pin. Same owner, same ACL, same checks.
-- prod_issue_context() itself is not touched, so Move behaves exactly as before.
-- No table, policy, role or row is changed.
-- Rollback: 14-ask-prod-investor-context-rollback.sql.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is null
     or to_regprocedure('v23_private.prod_session_live(uuid,uuid)') is null
     or to_regrole('myth_v23_foundation') is null or to_regrole('myth_v23_authorizer') is null then
    raise exception 'V23_PROD_INVESTOR_CONTEXT_PRECONDITION_FAIL: 02-ask-prod-ports-forward.sql must be applied first';
  end if;
  if to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)') is not null then
    raise exception 'V23_PROD_INVESTOR_CONTEXT_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
  -- The Investor production origin must already be the registered one.
  if not ops.origin_allowed('investor', 'https://www.investortrusthub.com', 'production') then
    raise exception 'V23_PROD_INVESTOR_CONTEXT_PRECONDITION_FAIL: investor production origin is not registered';
  end if;
end $$;

create function v23_private.prod_investor_issue_context(proof jsonb,subject uuid,session uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $$
declare pin v23_private.prod_deployment_pin%rowtype;
begin
 if not v23_private.prod_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 select * into strict pin from v23_private.prod_deployment_pin where singleton;
 if proof->>'targetOrigin' is distinct from pin.ask_origin then raise exception 'origin' using errcode='42501'; end if;
 if not coalesce(proof->>'code' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'state' ~ '^[A-Za-z0-9_-]{43}$'
   and proof->>'nonce' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'intent' ~ '^[A-Za-z0-9_-]{43}$',false)
   then raise exception 'proof' using errcode='42501'; end if;
 perform ops.create_browser_handoff_intent('auth',proof->>'intent','ask',pin.ask_origin,'/my/profile-save',
   proof->>'state',proof->>'nonce','production',proof->>'rateBucket');
 perform ops.create_consumer_auth_handoff(proof->>'code',subject,'investor','https://www.investortrusthub.com',proof->>'intent',
   (proof->>'creationKey')::uuid,proof->>'rateBucket');
 return true;
end $$;
revoke all on function v23_private.prod_investor_issue_context(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function v23_private.prod_investor_issue_context(jsonb,uuid,uuid) to myth_v23_authorizer;

-- Set ACL before owner transfer, then remove only the temporary operator membership.
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.prod_investor_issue_context(jsonb,uuid,uuid) owner to myth_v23_foundation;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

do $$ begin
  if has_function_privilege('public','v23_private.prod_investor_issue_context(jsonb,uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_investor_issue_context(jsonb,uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_investor_issue_context(jsonb,uuid,uuid)','EXECUTE')
     or has_function_privilege('myth_v23_executor','v23_private.prod_investor_issue_context(jsonb,uuid,uuid)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_investor_issue_context(jsonb,uuid,uuid)','EXECUTE')
     or (select proowner::regrole::text from pg_proc where oid=to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)')) <> 'myth_v23_foundation'
     or has_schema_privilege('myth_v23_foundation','v23_private','CREATE') then
    raise exception 'V23_PROD_INVESTOR_CONTEXT_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_INVESTOR_CONTEXT_APPLIED';
end $$;
commit;
