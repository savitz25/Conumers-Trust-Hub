-- MY TRUSTHUB V2 — NETWORK AUTHORITY ROLLBACK (operator).
-- Packet 19. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Restores v23_private.authority() to the reviewed three-hub migration body
-- (move, insurance, lender). This is the only predecessor Packet 19's forward
-- treats as the production starting point. It does not restore a packet 14,
-- 16, or 17 body, and it does not drop the function.
--
-- Runs only when the installed body is exactly the packet 19 six-hub body.
-- A second run stops. Bindings, Saved research, account-context issuers, and
-- every other function are unchanged. This file contains no DELETE.
--
-- STEWARD REVIEW: after any successful Investor, Contractor, or Senior
-- consumer Save, do not run this rollback until a steward has reviewed those
-- rows. Rolling authority back to the three-hub body makes new stages for
-- those hubs fail closed. It does not remove the Saved rows. If such rows
-- exist this file raises a notice and still performs only the function
-- restore, so an operator who has already accepted the steward review is not
-- blocked by a second hidden mutation.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $pre$
declare
  body text;
  final_body text := $final$
declare c jsonb; op text;
begin
  select authority into c from v23_private.transaction_authority
    where backend=pg_backend_pid() and transaction_id=txid_current();
  op:=c->>'operation';
  if c is null or not coalesce(c->>'hub' in ('move','insurance','lender','investor','contractor','senior') and c->>'audience'='ask'
    and c->>'service' = 'svc:trusthub:'||(c->>'hub')||':bff:v1'
    and c->>'browser' ~ '^[a-f0-9]{64}$',false) then raise exception 'invalid authority' using errcode='42501'; end if;
  if c->>'hub' = 'investor' then
    if op = 'prepareGuestProfileTransfer' then
      if jsonb_typeof(c#>'{input,selected}') is distinct from 'array'
         or jsonb_array_length(c#>'{input,selected}') < 1
         or c#>>'{input,sourceHub}' is distinct from 'investor'
         or c#>>'{input,returnTask,hub}' is distinct from 'investor'
         or c#>>'{input,returnTask,profile,hub}' is distinct from 'investor'
         or c#>>'{input,returnTask,profile,profileClass}' is distinct from 'official_firm'
         or coalesce(c#>>'{input,returnTask,profile,nativeId}','') !~ '^crd-[1-9][0-9]{0,9}$'
         or (c#>'{input,returnTask,profile}' ? 'identifierNamespace' and c#>>'{input,returnTask,profile,identifierNamespace}' is distinct from 'sec.crd')
      then raise exception 'invalid authority' using errcode='42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(c#>'{input,selected}') as item
        where item#>>'{profile,hub}' is distinct from 'investor'
           or item#>>'{profile,profileClass}' is distinct from 'official_firm'
           or coalesce(item#>>'{profile,nativeId}','') !~ '^crd-[1-9][0-9]{0,9}$'
           or (item->'profile' ? 'identifierNamespace' and item#>>'{profile,identifierNamespace}' is distinct from 'sec.crd')
      ) then raise exception 'invalid authority' using errcode='42501'; end if;
    elsif op = 'commitProfileSave'
       or (op = 'verifyProfileSaveReceipt' and c#>'{input,item,profile}' is not null) then
      if c#>>'{input,item,profile,hub}' is distinct from 'investor'
         or c#>>'{input,item,profile,profileClass}' is distinct from 'official_firm'
         or coalesce(c#>>'{input,item,profile,nativeId}','') !~ '^crd-[1-9][0-9]{0,9}$'
         or (c#>'{input,item,profile}' ? 'identifierNamespace' and c#>>'{input,item,profile,identifierNamespace}' is distinct from 'sec.crd')
      then raise exception 'invalid authority' using errcode='42501'; end if;
    end if;
  elsif c->>'hub' = 'contractor' then
    if op = 'prepareGuestProfileTransfer' then
      if jsonb_typeof(c#>'{input,selected}') is distinct from 'array'
         or jsonb_array_length(c#>'{input,selected}') < 1
         or c#>>'{input,sourceHub}' is distinct from 'contractor'
         or c#>>'{input,returnTask,hub}' is distinct from 'contractor'
         or c#>>'{input,returnTask,profile,hub}' is distinct from 'contractor'
         or c#>>'{input,returnTask,profile,profileClass}' is distinct from 'contractor_profile'
         or coalesce(c#>>'{input,returnTask,profile,nativeId}','') !~ '^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$'
         or (c#>'{input,returnTask,profile}' ? 'identifierNamespace' and c#>>'{input,returnTask,profile,identifierNamespace}' is distinct from 'fl.dbpr.license')
      then raise exception 'invalid authority' using errcode='42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(c#>'{input,selected}') as item
        where item#>>'{profile,hub}' is distinct from 'contractor'
           or item#>>'{profile,profileClass}' is distinct from 'contractor_profile'
           or coalesce(item#>>'{profile,nativeId}','') !~ '^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$'
           or (item->'profile' ? 'identifierNamespace' and item#>>'{profile,identifierNamespace}' is distinct from 'fl.dbpr.license')
      ) then raise exception 'invalid authority' using errcode='42501'; end if;
    elsif op = 'commitProfileSave'
       or (op = 'verifyProfileSaveReceipt' and c#>'{input,item,profile}' is not null) then
      if c#>>'{input,item,profile,hub}' is distinct from 'contractor'
         or c#>>'{input,item,profile,profileClass}' is distinct from 'contractor_profile'
         or coalesce(c#>>'{input,item,profile,nativeId}','') !~ '^fl\.dbpr\.license:[A-Z]{1,4}[0-9]{3,9}$'
         or (c#>'{input,item,profile}' ? 'identifierNamespace' and c#>>'{input,item,profile,identifierNamespace}' is distinct from 'fl.dbpr.license')
      then raise exception 'invalid authority' using errcode='42501'; end if;
    end if;
  elsif c->>'hub' = 'senior' then
    if op = 'prepareGuestProfileTransfer' then
      if jsonb_typeof(c#>'{input,selected}') is distinct from 'array'
         or jsonb_array_length(c#>'{input,selected}') < 1
         or c#>>'{input,sourceHub}' is distinct from 'senior'
         or c#>>'{input,returnTask,hub}' is distinct from 'senior'
         or c#>>'{input,returnTask,profile,hub}' is distinct from 'senior'
         or c#>>'{input,returnTask,profile,profileClass}' is distinct from 'cms_facility'
         or coalesce(c#>>'{input,returnTask,profile,nativeId}','') !~ '^[A-Za-z0-9]{6}$'
         or (c#>'{input,returnTask,profile}' ? 'identifierNamespace' and c#>>'{input,returnTask,profile,identifierNamespace}' is distinct from 'cms.ccn')
      then raise exception 'invalid authority' using errcode='42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(c#>'{input,selected}') as item
        where item#>>'{profile,hub}' is distinct from 'senior'
           or item#>>'{profile,profileClass}' is distinct from 'cms_facility'
           or coalesce(item#>>'{profile,nativeId}','') !~ '^[A-Za-z0-9]{6}$'
           or (item->'profile' ? 'identifierNamespace' and item#>>'{profile,identifierNamespace}' is distinct from 'cms.ccn')
      ) then raise exception 'invalid authority' using errcode='42501'; end if;
    elsif op = 'commitProfileSave'
       or (op = 'verifyProfileSaveReceipt' and c#>'{input,item,profile}' is not null) then
      if c#>>'{input,item,profile,hub}' is distinct from 'senior'
         or c#>>'{input,item,profile,profileClass}' is distinct from 'cms_facility'
         or coalesce(c#>>'{input,item,profile,nativeId}','') !~ '^[A-Za-z0-9]{6}$'
         or (c#>'{input,item,profile}' ? 'identifierNamespace' and c#>>'{input,item,profile,identifierNamespace}' is distinct from 'cms.ccn')
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
end
$final$;
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if body is null
     or md5(regexp_replace(body, '\s+', '', 'g')) is distinct from md5(regexp_replace(final_body, '\s+', '', 'g')) then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_ROLLBACK_PRECONDITION_FAIL: installed authority() is not the packet 19 body';
  end if;
end
$pre$;

create or replace function v23_private.authority() returns jsonb language plpgsql security invoker
set search_path=pg_catalog,v23_private as $baseline$
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
end
$baseline$;

do $post$
declare body text;
begin
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if position($t$c->>'hub' in ('move','insurance','lender') and c->>'audience'='ask'$t$ in body) = 0
     or position($t$'investor'$t$ in body) > 0
     or position($t$'contractor'$t$ in body) > 0
     or position($t$'senior'$t$ in body) > 0
     or position($t$'official_firm'$t$ in body) > 0 then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_ROLLBACK_FAIL';
  end if;
  if has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE')
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()')) then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_ACL_FAIL';
  end if;
  if exists (
    select 1 from consumer.consumer_saved_entities
     where source_hub in ('investor','contractor','senior') and removed_at is null
  ) then
    raise notice 'V23_PROD_NETWORK_AUTHORITY_ROLLBACK_STEWARD: investor, contractor, or senior Saved rows exist; this restore does not delete them';
  end if;
  raise notice 'V23_PROD_NETWORK_AUTHORITY_ROLLED_BACK';
end
$post$;
commit;
