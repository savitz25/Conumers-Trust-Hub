-- MY TRUSTHUB V2 — NETWORK AUTHORITY PREFLIGHT (READ ONLY).
-- Packet 19. NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Reports the installed v23_private.authority() without replacing it.
-- Reviewed states are baseline, packet 14's exact authority body, packet 16's
-- exact authority body, a packet 17-style hub-list edit of the migration
-- text, and the packet 19 body itself. Anything else stops.
-- After a passing run:
--   v23.network_authority_state   baseline | packet14_authority | packet16_authority
--                                 | packet17_style | applied
--   v23.network_authority_hubs    the hubs named in the installed list
-- This file does not create, replace, or drop a function, and it does not
-- read a browser hub.
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
  if body is null then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_FAIL: v23_private.authority() is missing';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('v23_private.authority()'))
     or has_function_privilege('public','v23_private.authority()','EXECUTE')
     or has_function_privilege('anon','v23_private.authority()','EXECUTE')
     or has_function_privilege('authenticated','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.authority()','EXECUTE')
     or not has_function_privilege('myth_v23_foundation','v23_private.authority()','EXECUTE') then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_FAIL: owner or security mode drifted';
  end if;
  norm := md5(regexp_replace(body, '\s+', '', 'g'));
  hubs := substring(body from $re$c->>'hub' in \(([a-z',]+)\) and c->>'audience'='ask'$re$);
  if hubs is null or (length(body) - length(replace(body, hubs, ''))) <> length(hubs) then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_FAIL: installed authority() is not a reviewed predecessor';
  end if;
  listed := string_to_array(replace(hubs, '''', ''), ',');
  if norm = md5(regexp_replace(final_body, '\s+', '', 'g')) then
    state := 'applied';
  elsif norm = md5(regexp_replace(packet16, '\s+', '', 'g')) then
    state := 'packet16_authority';
  elsif not (array['move','insurance','lender'] <@ listed)
     or not (listed <@ array['move','insurance','lender','investor','contractor','senior'])
     or cardinality(listed) <> (select count(distinct h) from unnest(listed) h)
     or hubs is distinct from '''' || array_to_string(listed, ''',''') || ''''
     or md5(regexp_replace(replace(body, hubs, '@HUBS@'), '\s+', '', 'g'))
        is distinct from md5(regexp_replace(template, '\s+', '', 'g')) then
    raise exception 'V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_FAIL: installed authority() is not a reviewed predecessor';
  elsif listed = array['move','insurance','lender'] then
    state := 'baseline';
  elsif listed = array['move','insurance','lender','investor'] then
    state := 'packet14_authority';
  else
    state := 'packet17_style';
  end if;
  perform set_config('v23.network_authority_state', state, false);
  perform set_config('v23.network_authority_hubs', array_to_string(listed, ','), false);
  raise notice 'V23_PROD_NETWORK_AUTHORITY_PREFLIGHT_PASS state=% hubs=%', state, array_to_string(listed, ',');
end
$pre$;
commit;
