-- MY TRUSTHUB V2 — ADMIT THE CONTRACTOR CONTRACT TO THE V2-3 TRANSACTION AUTHORITY (FORWARD, operator).
-- Packet 16. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Packet 15 can issue a contractor account context. v23_private.authority()
-- (migration 20260919205200) still accepts only hub move, insurance, or lender,
-- so consume_context as contractor fails closed with invalid authority before
-- any Saved row can commit. This file is that authority change. It does not
-- change packet 15 and it does not create an account-context function.
--
-- WHAT CHANGES: one function body. The reviewed three-hub checks stay. The hub
-- list gains contractor, and a contractor-only guard admits a carried profile
-- only when it is hub contractor, profile class contractor_profile, and native
-- id fl.dbpr.license:<DBPR key>. Consume and continuation carry no profile;
-- they pass on hub contractor, which is the check consume_context makes.
-- Move, insurance, and lender keep the path they have today. No other hub is
-- added.
--
-- Owner, ACL, search_path, language, and security invoker stay (CREATE OR
-- REPLACE keeps them). No table, policy, role, grant, or row is touched.
--
-- The replace runs only when the installed body is exactly the reviewed
-- three-hub version. If contractor is already in the hub list, this file
-- raises and does not re-apply. That is a hold, not a clean skip.
-- Rollback: 16-ask-prod-contractor-authority-rollback.sql.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$ declare body text; begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if body is null then raise exception 'V23_PROD_CONTRACTOR_AUTHORITY_PRECONDITION_FAIL: v23_private.authority() is missing'; end if;
  if position($t$c->>'hub' in ('move','insurance','lender','contractor')$t$ in body) > 0 then
    raise exception 'V23_PROD_CONTRACTOR_AUTHORITY_PRECONDITION_FAIL: already applied; review, do not re-apply';
  end if;
  if position($t$c->>'hub' in ('move','insurance','lender') and c->>'audience'='ask'$t$ in body) = 0
     or md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace($reviewed$
declare c jsonb; op text;
begin
  select authority into c from v23_private.transaction_authority
    where backend=pg_backend_pid() and transaction_id=txid_current();
  op:=c->>'operation';
  if c is null or not coalesce(c->>'hub' in ('move','insurance','lender') and c->>'audience'='ask'
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
    raise exception 'V23_PROD_CONTRACTOR_AUTHORITY_PRECONDITION_FAIL: installed authority() is not the reviewed three-hub body';
  end if;
end $$;

create or replace function v23_private.authority() returns jsonb language plpgsql security invoker
set search_path=pg_catalog,v23_private as $authority$
declare c jsonb; op text;
begin
  select authority into c from v23_private.transaction_authority
    where backend=pg_backend_pid() and transaction_id=txid_current();
  op:=c->>'operation';
  if c is null or not coalesce(c->>'hub' in ('move','insurance','lender','contractor') and c->>'audience'='ask'
    and c->>'service' = 'svc:trusthub:'||(c->>'hub')||':bff:v1'
    and c->>'browser' ~ '^[a-f0-9]{64}$',false) then raise exception 'invalid authority' using errcode='42501'; end if;
  if c->>'hub' = 'contractor' then
    if op = 'prepareGuestProfileTransfer' then
      if jsonb_typeof(c#>'{input,selected}') is distinct from 'array'
         or jsonb_array_length(c#>'{input,selected}') < 1
         or c#>>'{input,sourceHub}' is distinct from 'contractor'
         or c#>>'{input,returnTask,hub}' is distinct from 'contractor'
         or c#>>'{input,returnTask,profile,hub}' is distinct from 'contractor'
         or c#>>'{input,returnTask,profile,profileClass}' is distinct from 'contractor_profile'
         or coalesce(c#>>'{input,returnTask,profile,nativeId}','') !~ '^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$'
      then raise exception 'invalid authority' using errcode='42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(c#>'{input,selected}') as item
        where item#>>'{profile,hub}' is distinct from 'contractor'
           or item#>>'{profile,profileClass}' is distinct from 'contractor_profile'
           or coalesce(item#>>'{profile,nativeId}','') !~ '^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$'
      ) then raise exception 'invalid authority' using errcode='42501'; end if;
    elsif op = 'commitProfileSave'
       or (op = 'verifyProfileSaveReceipt' and c#>'{input,item,profile}' is not null) then
      if c#>>'{input,item,profile,hub}' is distinct from 'contractor'
         or c#>>'{input,item,profile,profileClass}' is distinct from 'contractor_profile'
         or coalesce(c#>>'{input,item,profile,nativeId}','') !~ '^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$'
      then raise exception 'invalid authority' using errcode='42501'; end if;
    end if;
  end if;
  if op in ('prepareGuestProfileTransfer','prepareProfileSaveContinuation') then
    if not coalesce(c->'scopes' ? 'transfer:stage',false) then raise exception 'scope' using errcode='42501'; end if;
  elsif op in ('consumeProfileSaveContinuation','commitProfileSave','getProfileSaveReceipt','verifyProfileSaveReceipt') then
    if not coalesce(c->'scopes' ? 'saved:write',false) or nullif(c->>'subject','') is null or nullif(c->>'session','') is null then raise exception 'parent authority' using errcode='42501'; end if;
    if op='verifyProfileSaveReceipt' and not coalesce(c->'scopes' ? 'receipt:verify',false) then raise exception 'scope' using errcode='42501'; end if;
  else raise exception 'operation' using errcode='42501'; end if;
  return c;
end $authority$;

do $$ begin
  if has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE')
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()')) then
    raise exception 'V23_PROD_CONTRACTOR_AUTHORITY_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_CONTRACTOR_AUTHORITY_APPLIED';
end $$;
commit;
