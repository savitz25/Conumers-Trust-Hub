-- TEST FIXTURE ONLY. Not an operator packet and not applied in production.
-- The exact v23_private.authority() statement from certified packet 19,
-- PR #236 head 3b565707946b7c93252b767cf10aa185336ec8b1. The preflight
-- classifies the installed prosrc, not this file.
create or replace function v23_private.authority() returns jsonb language plpgsql security invoker
set search_path=pg_catalog,v23_private as $final$
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
         or coalesce(c#>>'{input,returnTask,profile,nativeId}','') !~ '^[A-Z0-9]{6}$'
         or (c#>'{input,returnTask,profile}' ? 'identifierNamespace' and c#>>'{input,returnTask,profile,identifierNamespace}' is distinct from 'cms.ccn')
      then raise exception 'invalid authority' using errcode='42501'; end if;
      if exists (
        select 1 from jsonb_array_elements(c#>'{input,selected}') as item
        where item#>>'{profile,hub}' is distinct from 'senior'
           or item#>>'{profile,profileClass}' is distinct from 'cms_facility'
           or coalesce(item#>>'{profile,nativeId}','') !~ '^[A-Z0-9]{6}$'
           or (item->'profile' ? 'identifierNamespace' and item#>>'{profile,identifierNamespace}' is distinct from 'cms.ccn')
      ) then raise exception 'invalid authority' using errcode='42501'; end if;
    elsif op = 'commitProfileSave'
       or (op = 'verifyProfileSaveReceipt' and c#>'{input,item,profile}' is not null) then
      if c#>>'{input,item,profile,hub}' is distinct from 'senior'
         or c#>>'{input,item,profile,profileClass}' is distinct from 'cms_facility'
         or coalesce(c#>>'{input,item,profile,nativeId}','') !~ '^[A-Z0-9]{6}$'
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
