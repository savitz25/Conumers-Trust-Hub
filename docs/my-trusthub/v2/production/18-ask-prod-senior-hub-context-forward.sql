-- MY TRUSTHUB V2 — ADMIT SENIOR TO THE SHARED ACCOUNT-CONTEXT ISSUER (FORWARD, operator).
-- Packet 18. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- WHY: Packet 15's prod_hub_issue_context admits lender, insurance, and
-- contractor only. A verified Senior stage must use that same function with
-- hub 'senior'. It must not use prod_issue_context, prod_investor_issue_context,
-- or a new prod_senior_issue_context.
--
-- WHAT CHANGES: the installed shared issuer is replaced with the same body plus
-- one exact arm:
--     senior -> https://www.seniortrusthub.com
-- The origin is pinned inside the function. It is not read from the proof or
-- from a browser field. lender, insurance, and contractor keep their Packet 15
-- origins. Every other hub is still refused, including move, investor, empty,
-- case and whitespace variants, lists, and wildcards.
--
-- WHAT DOES NOT CHANGE: the Packet 15 files, prod_issue_context,
-- prod_investor_issue_context, consume_context, v23_private.authority(),
-- bindings, and Saved research. Packet 17 owns Senior authority and the CMS
-- CCN bindings. This packet does not make a Senior Saveable by itself.
--
-- The installed body must match the frozen Packet 15 function. Any other body
-- stops. This file does not create the function when Packet 15 is absent.
-- The operator assumes myth_v23_foundation only for the replace, after that
-- check, and revokes the membership before commit.
--
-- Rollback: 18-ask-prod-senior-hub-context-rollback.sql.
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
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is null
     or to_regprocedure('v23_private.authority()') is null then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: Move issuer or authority() is missing';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)');
  if body is null then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: packet 15 shared issuer is not installed';
  end if;
  if md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace(frozen, '\s+', '', 'g')) then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: installed shared issuer is not the frozen packet 15 body';
  end if;
  if position('when ''senior''' in body) > 0 then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: already applied; review, do not re-apply';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) is not true
     or (select proowner::regrole::text from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) <> 'myth_v23_foundation' then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: owner or security mode drifted';
  end if;
  if not ops.origin_allowed('senior', 'https://www.seniortrusthub.com', 'production') then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PRECONDITION_FAIL: senior production origin is not registered';
  end if;
end
$pre$;
select set_config('v23.packet18_move_md5', (select md5(prosrc) from pg_proc where oid = to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)')), true);
select set_config('v23.packet18_authority_md5', (select md5(prosrc) from pg_proc where oid = to_regprocedure('v23_private.authority()')), true);
select set_config('v23.packet18_investor_md5', coalesce((select md5(prosrc) from pg_proc where oid = to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)')), ''), true);

-- Same reviewed owner session as packet 02: membership, set role, owned work, reset, revoke.
grant create on schema v23_private to myth_v23_foundation;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;

create or replace function v23_private.prod_hub_issue_context(proof jsonb,subject uuid,session uuid,p_hub text) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $$
declare pin v23_private.prod_deployment_pin%rowtype; hub_origin text;
begin
 hub_origin:=case p_hub when 'lender' then 'https://www.lendertrusthub.com'
                        when 'insurance' then 'https://www.insurancetrusthub.com'
                        when 'contractor' then 'https://www.contractortrusthub.com'
                        when 'senior' then 'https://www.seniortrusthub.com' end;
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
alter function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text) owner to myth_v23_foundation;
reset role;
revoke create on schema v23_private from myth_v23_foundation;
revoke myth_v23_foundation from current_user granted by current_user;

do $post$
declare
  body text;
  admitted text := $admitted$
declare pin v23_private.prod_deployment_pin%rowtype; hub_origin text;
begin
 hub_origin:=case p_hub when 'lender' then 'https://www.lendertrusthub.com'
                        when 'insurance' then 'https://www.insurancetrusthub.com'
                        when 'contractor' then 'https://www.contractortrusthub.com'
                        when 'senior' then 'https://www.seniortrusthub.com' end;
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
$admitted$;
begin
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)');
  if md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace(admitted, '\s+', '', 'g'))
     or position('when ''senior'' then ''https://www.seniortrusthub.com''' in body) = 0
     or position('when ''lender'' then ''https://www.lendertrusthub.com''' in body) = 0
     or position('when ''insurance'' then ''https://www.insurancetrusthub.com''' in body) = 0
     or position('when ''contractor'' then ''https://www.contractortrusthub.com''' in body) = 0
     or (length(body) - length(replace(body, 'when ''', ''))) / length('when ''') <> 4 then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_APPLY_FAIL';
  end if;
  if has_function_privilege('public','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('myth_v23_executor','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)','EXECUTE')
     or (select proowner::regrole::text from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) <> 'myth_v23_foundation'
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) is not true
     or has_schema_privilege('myth_v23_foundation','v23_private','CREATE') then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_ACL_FAIL';
  end if;
  if md5((select prosrc from pg_proc where oid = to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)')))
       is distinct from current_setting('v23.packet18_move_md5')
     or md5((select prosrc from pg_proc where oid = to_regprocedure('v23_private.authority()')))
       is distinct from current_setting('v23.packet18_authority_md5')
     or coalesce(md5((select prosrc from pg_proc where oid = to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)'))), '')
       is distinct from current_setting('v23.packet18_investor_md5') then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_APPLY_FAIL: another issuer changed';
  end if;
  raise notice 'V23_PROD_SENIOR_HUB_CONTEXT_APPLIED';
end
$post$;
commit;
