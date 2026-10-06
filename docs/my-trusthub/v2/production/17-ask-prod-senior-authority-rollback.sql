-- ============================================================================
-- SUPERSEDED BY PACKET 19 — DO NOT APPLY IN PRODUCTION.
-- The production authority step is 19-ask-prod-network-authority-forward.sql
-- (one six-hub authority). This file is kept for provenance and local recovery
-- evidence only. Packet 19's preflight recognises the body this file writes as
-- a legacy predecessor and converges it.
-- ============================================================================
-- MY TRUSTHUB V2 — REMOVE THE SENIOR HUB FROM THE V2-3 TRANSACTION AUTHORITY (ROLLBACK, operator).
-- Packet 17. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Removes the one token 'senior' that 17-ask-prod-senior-authority-forward.sql
-- appended to the hub list of v23_private.authority(). Every other character
-- of the installed body is kept, including any other hub its own packet added.
-- Runs only when 'senior' is the LAST entry of the list and the rest of the
-- body is the reviewed text. After it, every Senior stage is refused inside the
-- database again. Owner, ACL and every row are unchanged. Saved research is
-- not touched. Turn the Senior release gate off first.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$
declare
  body text;
  hubs text;
  listed text[];
  kept text;
  replaced text;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if body is null then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: v23_private.authority() is missing';
  end if;
  hubs := substring(body from $re$c->>'hub' in \(([a-z',]+)\) and c->>'audience'='ask'$re$);
  if hubs is null or (length(body) - length(replace(body, hubs, ''))) <> length(hubs) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: hub list not found exactly once';
  end if;
  listed := string_to_array(replace(hubs, '''', ''), ',');
  if not ('senior' = any(listed)) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: senior is not admitted; nothing to roll back';
  end if;
  if listed[cardinality(listed)] is distinct from 'senior'
     or not (array['move','insurance','lender'] <@ listed)
     or not (listed <@ array['move','insurance','lender','contractor','investor','senior'])
     or cardinality(listed) <> (select count(distinct h) from unnest(listed) h)
     or hubs is distinct from '''' || array_to_string(listed, ''',''') || '''' then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: installed hub list is not the one this packet wrote';
  end if;
  if md5(regexp_replace(replace(body, hubs, '@HUBS@'), '\s+', '', 'g')) is distinct from md5(regexp_replace($reviewed$
declare c jsonb; op text;
begin
  select authority into c from v23_private.transaction_authority
    where backend=pg_backend_pid() and transaction_id=txid_current();
  op:=c->>'operation';
  if c is null or not coalesce(c->>'hub' in (@HUBS@) and c->>'audience'='ask'
    and c->>'service' = 'svc:trusthub:'||(c->>'hub')||':bff:v1'
    and c->>'browser' ~ '^[a-f0-9]{64}$',false) then raise exception 'invalid authority' using errcode='42501'; end if;
  if op in ('prepareGuestProfileTransfer','prepareProfileSaveContinuation') then
    if not coalesce(c->'scopes' ? 'transfer:stage',false) then raise exception 'scope' using errcode='42501'; end if;
  elsif op in ('consumeProfileSaveContinuation','commitProfileSave','getProfileSaveReceipt','verifyProfileSaveReceipt') then
    if not coalesce(c->'scopes' ? 'saved:write',false) or nullif(c->>'subject','') is null or nullif(c->>'session','') is null then raise exception 'parent authority' using errcode='42501'; end if;
    if op='verifyProfileSaveReceipt' and not coalesce(c->'scopes' ? 'receipt:verify',false) then raise exception 'scope' using errcode='42501'; end if;
  else raise exception 'operation' using errcode='42501'; end if;
  return c;
end $reviewed$, '\s+', '', 'g')) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: installed authority() is not the reviewed body';
  end if;

  kept := '''' || array_to_string(listed[1:cardinality(listed) - 1], ''',''') || '''';
  replaced := replace(body, '(' || hubs || ')', '(' || kept || ')');
  execute format(
    'create or replace function v23_private.authority() returns jsonb language plpgsql security invoker set search_path=pg_catalog,v23_private as %L',
    replaced);

  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if position('''senior''' in substring(body from $re$c->>'hub' in \(([a-z',]+)\)$re$)) > 0 then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ROLLBACK_FAIL';
  end if;
  if has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE')
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()')) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_SENIOR_AUTHORITY_ROLLED_BACK';
end $$;
commit;
