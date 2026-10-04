-- MY TRUSTHUB V2 — PER-HUB ACCOUNT CONTEXT ISSUER (FORWARD, operator).
-- NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw. Requires 00..06.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- WHY: v23_private.prod_issue_context() issues the one-time account context as
-- issuer hub 'move' from the Move origin, always. The Save commit consumes it
-- with the hub of the verified caller (v23_private.consume_context ->
-- ops.consume_consumer_auth_handoff(expected issuer = caller hub)). For Move
-- the two agree. For Lender, Insurance, or Contractor they do not: the consume
-- returns INVALID_AUDIENCE, consume_context raises 42501, no Saved row is
-- written and nothing is acknowledged. Packets 12, 13, and 16 do not touch this.
--
-- WHAT CHANGES: one new function. It is prod_issue_context() with the issuer
-- hub supplied by the runtime and the origin taken from a fixed map inside the
-- function:
--     lender     -> https://www.lendertrusthub.com
--     insurance  -> https://www.insurancetrusthub.com
--     contractor -> https://www.contractortrusthub.com
-- The Contractor origin is the production pin in the Contractor assertion
-- (contractorOrigin) and in PRODUCTION_ORIGINS.contractor. It is not the apex
-- alias and it is not read from the proof. Any other hub, including 'move' and
-- 'investor', is refused. A proof that carries hub, issuer, issuerHub, or
-- sourceHub is refused. The runtime passes the hub of the caller it verified
-- from the specialist's signed assertion.
--
-- WHAT DOES NOT CHANGE: prod_issue_context() (Move keeps using it, unmodified),
-- consume_context(), the hub check at consume time, single use, the 90 second
-- lifetime, the state and nonce binding, every table, policy, role and row.
-- A context issued for one hub is still consumable only as that hub.
--
-- Rollback: 15-ask-prod-hub-account-context-rollback.sql.
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
    raise exception 'V23_PROD_HUB_CONTEXT_PRECONDITION_FAIL: 02-ask-prod-ports-forward.sql must be applied first';
  end if;
  if to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is not null then
    raise exception 'V23_PROD_HUB_CONTEXT_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
  -- Each pinned production origin must already be the registered one.
  if not ops.origin_allowed('lender', 'https://www.lendertrusthub.com', 'production')
     or not ops.origin_allowed('insurance', 'https://www.insurancetrusthub.com', 'production')
     or not ops.origin_allowed('contractor', 'https://www.contractortrusthub.com', 'production') then
    raise exception 'V23_PROD_HUB_CONTEXT_PRECONDITION_FAIL: lender, insurance, or contractor production origin is not registered';
  end if;
end $$;

create function v23_private.prod_hub_issue_context(proof jsonb,subject uuid,session uuid,p_hub text) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $$
declare pin v23_private.prod_deployment_pin%rowtype; hub_origin text;
begin
 hub_origin:=case p_hub when 'lender' then 'https://www.lendertrusthub.com'
                        when 'insurance' then 'https://www.insurancetrusthub.com'
                        when 'contractor' then 'https://www.contractortrusthub.com' end;
 if hub_origin is null or proof ? 'hub' or proof ? 'issuer' or proof ? 'issuerHub' or proof ? 'sourceHub'
  then raise exception 'hub' using errcode='42501'; end if;
 if not v23_private.prod_session_live(subject,session) then raise exception 'session' using errcode='42501'; end if;
 select * into strict pin from v23_private.prod_deployment_pin where singleton;
 if proof->>'targetOrigin' is distinct from pin.ask_origin then raise exception 'origin' using errcode='42501'; end if;
 if not coalesce(proof->>'code' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'state' ~ '^[A-Za-z0-9_-]{43}$'
   and proof->>'nonce' ~ '^[A-Za-z0-9_-]{43}$' and proof->>'intent' ~ '^[A-Za-z0-9_-]{43}$',false)
   then raise exception 'proof' using errcode='42501'; end if;
 perform ops.create_browser_handoff_intent('auth',proof->>'intent','ask',pin.ask_origin,'/my/profile-save',
   proof->>'state',proof->>'nonce','production',proof->>'rateBucket');
 perform ops.create_consumer_auth_handoff(proof->>'code',subject,p_hub,hub_origin,proof->>'intent',
   (proof->>'creationKey')::uuid,proof->>'rateBucket');
 return true;
end $$;
revoke all on function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text) from public,anon,authenticated;
grant execute on function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text) to myth_v23_authorizer;

-- Set ACL before owner transfer, then remove only the temporary operator membership.
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text) owner to myth_v23_foundation;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

do $$ begin
  if has_function_privilege('public','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('myth_v23_executor','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or (select proowner::regrole::text from pg_proc where oid=to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) <> 'myth_v23_foundation'
     or has_schema_privilege('myth_v23_foundation','v23_private','CREATE') then
    raise exception 'V23_PROD_HUB_CONTEXT_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_HUB_CONTEXT_APPLIED';
end $$;
commit;
