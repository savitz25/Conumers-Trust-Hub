-- MY TRUSTHUB V2 — PER-HUB ACCOUNT CONTEXT ISSUER (ROLLBACK, operator).
-- NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Removes exactly the one function created by
-- 15-ask-prod-hub-account-context-forward.sql. No row is touched and
-- prod_issue_context() is untouched, so Move is unaffected. After it, a Lender,
-- Insurance, or Contractor Save cannot obtain an account context and fails
-- closed (device Save only). Turn those release gates off first. Investor keeps
-- prod_investor_issue_context; this rollback does not drop it.
--
-- The installed function must be the frozen Packet 15 body, with that packet's
-- signature, owner, security definer, search_path, and ACL. Packet 18 replaces
-- the body with the Senior arm and is not a predecessor: dropping it here would
-- remove the function Packet 18 rollback has to restore. Run
-- 18-ask-prod-senior-hub-context-rollback.sql first. Existence alone is not
-- enough. This file does not use DROP CASCADE.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $pre$
declare
  body text;
  frozen text := $frozen$
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
end
$frozen$;
  fn oid;
  secdef boolean;
  volatile_kind text;
  owner_name text;
  config text;
  language_name text;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  fn := to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)');
  if fn is null then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_PRECONDITION_FAIL: nothing to remove';
  end if;
  if regexp_replace(pg_get_function_identity_arguments(fn), '\s+', '', 'g')
     is distinct from 'proofjsonb,subjectuuid,sessionuuid,p_hubtext' then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_PRECONDITION_FAIL: signature drifted';
  end if;
  select p.prosrc, p.prosecdef, p.provolatile::text, p.proowner::regrole::text,
         regexp_replace(coalesce(array_to_string(p.proconfig, ','), ''), '\s+', '', 'g'),
         l.lanname
    into body, secdef, volatile_kind, owner_name, config, language_name
    from pg_proc p
    join pg_language l on l.oid = p.prolang
   where p.oid = fn;
  if md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace(frozen, '\s+', '', 'g')) then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_PRECONDITION_FAIL: installed shared issuer is not the frozen packet 15 body';
  end if;
  if secdef is not true
     or volatile_kind is distinct from 'v'
     or owner_name is distinct from 'myth_v23_foundation'
     or language_name is distinct from 'plpgsql'
     or config is distinct from 'search_path=pg_catalog,v23_private,ops'
     or has_function_privilege('public', fn, 'EXECUTE')
     or has_function_privilege('anon', fn, 'EXECUTE')
     or has_function_privilege('authenticated', fn, 'EXECUTE')
     or has_function_privilege('myth_v23_executor', fn, 'EXECUTE')
     or not has_function_privilege('myth_v23_authorizer', fn, 'EXECUTE')
     or has_schema_privilege('myth_v23_foundation', 'v23_private', 'CREATE') then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_PRECONDITION_FAIL: owner, security, or acl drifted';
  end if;
end
$pre$;
drop function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text);
do $$ begin
  if to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is null then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_FAIL: the Move issuer must remain';
  end if;
  if to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is not null then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_FAIL: the shared issuer must be gone';
  end if;
  raise notice 'V23_PROD_HUB_CONTEXT_ROLLED_BACK';
end $$;
commit;
