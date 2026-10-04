-- MY TRUSTHUB V2 — ADMIT THE SENIOR HUB TO THE V2-3 TRANSACTION AUTHORITY (FORWARD, operator).
-- Packet 17. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- WHY: v23_private.authority() (migration 20260919205200) accepts a transaction
-- authority only for the hubs named in its one hub list (move, insurance,
-- lender as installed). Every V2-3 runtime record policy and the Save wrapper
-- call it, so a Senior stage is refused inside the database with
-- "invalid authority" until 'senior' is in that list. The binding packet alone
-- is not enough.
--
-- WHAT CHANGES: one token in one function body. 'senior' is appended to the
-- installed hub list; every other character of the installed body is kept.
-- Owner, ACL, search_path, language and security mode are unchanged
-- (CREATE OR REPLACE keeps them). No table, policy, role, grant or row is
-- touched. This file contains no account-context SQL.
--
-- ORDER WITH OTHER PACKETS: the installed list may already carry another hub
-- added by its own reviewed packet (packet 14 adds 'investor'). This file
-- accepts the installed body only when, with its hub list set aside, it is
-- exactly the reviewed text below, and the list holds move, insurance, lender
-- plus nothing outside the six network hubs. Anything else stops for review.
-- Packets that require an exact list (14) must be applied before this one, and
-- rolled back after 17-ask-prod-senior-authority-rollback.sql.
--
-- Rollback: 17-ask-prod-senior-authority-rollback.sql.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$
declare
  body text;
  hubs text;
  listed text[];
  replaced text;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if body is null then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_PRECONDITION_FAIL: v23_private.authority() is missing';
  end if;
  hubs := substring(body from $re$c->>'hub' in \(([a-z',]+)\) and c->>'audience'='ask'$re$);
  if hubs is null or (length(body) - length(replace(body, hubs, ''))) <> length(hubs) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_PRECONDITION_FAIL: hub list not found exactly once';
  end if;
  listed := string_to_array(replace(hubs, '''', ''), ',');
  if 'senior' = any(listed) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_PRECONDITION_FAIL: already applied; review, do not re-apply';
  end if;
  if not (array['move','insurance','lender'] <@ listed)
     or not (listed <@ array['move','insurance','lender','contractor','investor'])
     or cardinality(listed) <> (select count(distinct h) from unnest(listed) h)
     or hubs is distinct from '''' || array_to_string(listed, ''',''') || '''' then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_PRECONDITION_FAIL: installed hub list is not a reviewed list';
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
    raise exception 'V23_PROD_SENIOR_AUTHORITY_PRECONDITION_FAIL: installed authority() is not the reviewed body';
  end if;

  replaced := replace(body, '(' || hubs || ')', '(' || hubs || ',''senior'')');
  execute format(
    'create or replace function v23_private.authority() returns jsonb language plpgsql security invoker set search_path=pg_catalog,v23_private as %L',
    replaced);

  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if position('(' || hubs || ',''senior'') and c->>''audience''=''ask''' in body) = 0 then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_APPLY_FAIL';
  end if;
  if has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE')
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()')) then
    raise exception 'V23_PROD_SENIOR_AUTHORITY_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_SENIOR_AUTHORITY_APPLIED';
end $$;
commit;
