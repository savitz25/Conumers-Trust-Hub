-- MY TRUSTHUB V2 — SENIOR SHARED-HUB CONTEXT PREFLIGHT (READ ONLY).
-- Packet 18. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Confirms the installed shared issuer is the frozen Packet 15 function and
-- that Senior is not already admitted. A mismatch stops. This file does not
-- replace, drop, or create a function, and it does not read a browser hub.
--
-- The frozen body below is the function body of
-- 15-ask-prod-hub-account-context-forward.sql. Packet 15 itself is not edited.
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
  if to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is null then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: the Move issuer is missing';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)');
  if body is null then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: packet 15 shared issuer is not installed';
  end if;
  if md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace(frozen, '\s+', '', 'g')) then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: installed shared issuer is not the frozen packet 15 body';
  end if;
  if position('when ''senior''' in body) > 0 or position('https://www.seniortrusthub.com' in body) > 0 then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: senior is already admitted; review, do not replace';
  end if;
  if position('when ''lender'' then ''https://www.lendertrusthub.com''' in body) = 0
     or position('when ''insurance'' then ''https://www.insurancetrusthub.com''' in body) = 0
     or position('when ''contractor'' then ''https://www.contractortrusthub.com''' in body) = 0
     or (length(body) - length(replace(body, 'when ''', ''))) / length('when ''') <> 3 then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: hub-origin map drifted';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) is not true
     or (select proowner::regrole::text from pg_proc where oid = to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)')) <> 'myth_v23_foundation' then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: owner or security mode drifted';
  end if;
  if not ops.origin_allowed('lender', 'https://www.lendertrusthub.com', 'production')
     or not ops.origin_allowed('insurance', 'https://www.insurancetrusthub.com', 'production')
     or not ops.origin_allowed('contractor', 'https://www.contractortrusthub.com', 'production')
     or not ops.origin_allowed('senior', 'https://www.seniortrusthub.com', 'production') then
    raise exception 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_FAIL: a pinned production origin is not registered';
  end if;
  raise notice 'V23_PROD_SENIOR_HUB_CONTEXT_PREFLIGHT_PASS';
end
$pre$;
commit;
