-- SUPERSEDED BY PACKET 19 — DO NOT APPLY IN PRODUCTION
-- The production authority transition is 19-ask-prod-network-authority-forward.sql.
-- This file remains the audited predecessor. Its rollback is not a safe undo
-- after packet 19: packet 19 rollback restores the three-hub body only from the
-- packet 19 body, and this rollback refuses any other body.
-- Not part of the production activation order. Kept for history and recovery
-- evidence only: packet 19 forward accepts this file's four-hub body as a
-- reviewed predecessor if it was ever applied by mistake.
--
-- MY TRUSTHUB V2 — REMOVE THE INVESTOR HUB FROM THE V2-3 TRANSACTION AUTHORITY (ROLLBACK, operator).
-- NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Restores v23_private.authority() to the reviewed three-hub body (move,
-- insurance, lender). Runs only when the installed body is exactly the
-- four-hub version written by 14-ask-prod-investor-authority-forward.sql.
-- After it, every Investor stage is refused inside the database again. Owner,
-- ACL and every row are unchanged. Turn the Investor release gate off first.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$ declare body text; begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if body is null then raise exception 'V23_PROD_INVESTOR_AUTHORITY_PRECONDITION_FAIL: v23_private.authority() is missing'; end if;
  if position($t$c->>'hub' in ('move','insurance','lender')$t$ in body) > 0 then
    raise exception 'V23_PROD_INVESTOR_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: already the three-hub body';
  end if;
  if position($t$c->>'hub' in ('move','insurance','lender','investor') and c->>'audience'='ask'$t$ in body) = 0
     or md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace($reviewed$
declare c jsonb; op text;
begin
  select authority into c from v23_private.transaction_authority
    where backend=pg_backend_pid() and transaction_id=txid_current();
  op:=c->>'operation';
  if c is null or not coalesce(c->>'hub' in ('move','insurance','lender','investor') and c->>'audience'='ask'
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
    raise exception 'V23_PROD_INVESTOR_AUTHORITY_PRECONDITION_FAIL: installed authority() is not the four-hub body written by the forward packet';
  end if;
end $$;

create or replace function v23_private.authority() returns jsonb language plpgsql security invoker
set search_path=pg_catalog,v23_private as $$
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
end $$;

do $$ begin
  if has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE')
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()')) then
    raise exception 'V23_PROD_INVESTOR_AUTHORITY_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_INVESTOR_AUTHORITY_ROLLED_BACK';
end $$;
commit;
