-- MY TRUSTHUB V2 — NETWORK AUTHORITY FINALIZATION (FORWARD, operator).
-- Packet 19. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- WHY: packets 14, 16, and 17 each replace v23_private.authority() from a
-- different predecessor. They do not compose. This file is the one production
-- transition from a reviewed predecessor to the six-hub authority.
--
-- FINAL HUBS, and only these:
--   move, insurance, lender     the reviewed three-hub checks, unchanged
--   investor                    official_firm / sec.crd as crd-<CRD>
--   contractor                  contractor_profile / fl.dbpr.license:<DBPR key>
--   senior                      cms_facility / cms.ccn as the bare CCN
-- Move, insurance, and lender gain no class or namespace predicate.
-- The hub is the authority row written by the authorizer for this transaction.
-- A browser field cannot select it.
--
-- REVIEWED PREDECESSORS, and no others:
--   the migration three-hub body (production path)
--   packet 14's exact four-hub body
--   packet 16's exact contractor body
--   a packet 17-style body whose only difference from the migration text is
--   the hub list, when that list is a unique subset of the six hubs and still
--   contains move, insurance, and lender
-- Any other body stops. A second run stops. This file does not create a
-- function when authority() is absent, and it does not touch bindings,
-- Saved research, account-context issuers, or any other function.
--
-- Packet 14, 16, and 17 authority forwards are superseded. Do not apply them
-- in production. Their binding and resolver files stay hub-specific.
-- Rollback: 19-ask-prod-network-authority-rollback.sql.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $pre$
declare
  body text;
  hubs text;
  listed text[];
  norm text;
  state text;
  template text := $template$
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
end
$template$;
  packet16 text := $packet16$
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
end
$packet16$;
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
begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if body is null then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PRECONDITION_FAIL: v23_private.authority() is missing';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()'))
     or has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE') then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PRECONDITION_FAIL: owner or security mode drifted';
  end if;
  norm := md5(regexp_replace(body, '\s+', '', 'g'));
  if norm = md5(regexp_replace(final_body, '\s+', '', 'g')) then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PRECONDITION_FAIL: already applied; review, do not re-apply';
  elsif norm = md5(regexp_replace(packet16, '\s+', '', 'g')) then
    state := 'packet16_authority';
  else
    hubs := substring(body from $re$c->>'hub' in \(([a-z',]+)\) and c->>'audience'='ask'$re$);
    if hubs is null or (length(body) - length(replace(body, hubs, ''))) <> length(hubs) then
      raise exception 'V23_PROD_NETWORK_AUTHORITY_PRECONDITION_FAIL: installed authority() is not a reviewed predecessor';
    end if;
    listed := string_to_array(replace(hubs, '''', ''), ',');
    if not (array['move','insurance','lender'] <@ listed)
       or not (listed <@ array['move','insurance','lender','investor','contractor','senior'])
       or cardinality(listed) <> (select count(distinct h) from unnest(listed) h)
       or hubs is distinct from '''' || array_to_string(listed, ''',''') || ''''
       or md5(regexp_replace(replace(body, hubs, '@HUBS@'), '\s+', '', 'g'))
          is distinct from md5(regexp_replace(template, '\s+', '', 'g')) then
      raise exception 'V23_PROD_NETWORK_AUTHORITY_PRECONDITION_FAIL: installed authority() is not a reviewed predecessor';
    end if;
    if listed = array['move','insurance','lender'] then
      state := 'baseline';
    elsif listed = array['move','insurance','lender','investor'] then
      state := 'packet14_authority';
    else
      state := 'packet17_style';
    end if;
  end if;
  perform set_config('v23.network_authority_predecessor', state, false);
end
$pre$;

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

do $post$
declare body text;
begin
  select prosrc into body from pg_proc where oid = to_regprocedure('v23_private.authority()');
  if position($t$c->>'hub' in ('move','insurance','lender','investor','contractor','senior') and c->>'audience'='ask'$t$ in body) = 0
     or position($t$'official_firm'$t$ in body) = 0
     or position($t$'contractor_profile'$t$ in body) = 0
     or position($t$'cms_facility'$t$ in body) = 0
     or position($t$'sec.crd'$t$ in body) = 0
     or position($t$'fl.dbpr.license'$t$ in body) = 0
     or position($t$'cms.ccn'$t$ in body) = 0 then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_APPLY_FAIL';
  end if;
  if has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE')
     or (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()')) then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_ACL_FAIL';
  end if;
  raise notice 'V23_PROD_NETWORK_AUTHORITY_APPLIED predecessor=%', current_setting('v23.network_authority_predecessor', true);
end
$post$;
commit;
