-- My TrustHub P13: parent-owned cross-hub state and one-time handoff foundation.
-- Apply only after P11B and P12. No Watch, Alert, observation, or notification objects.

begin;

create extension if not exists pgcrypto with schema extensions;

do $$
declare role_name text;
begin
  foreach role_name in array array[
    'myth_handoff_broker',
    'myth_consumer_api',
    'myth_bff_ask',
    'myth_bff_move',
    'myth_bff_lender',
    'myth_bff_insurance',
    'myth_bff_contractor',
    'myth_bff_senior',
    'myth_bff_investor'
  ] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I nologin noinherit', role_name);
    end if;
  end loop;
end;
$$;

comment on role myth_handoff_broker is
  'Parent-only broker for browser-bound auth/context handoffs. Never distributed to specialist applications.';
comment on role myth_consumer_api is
  'Parent /v1/my service role. It requires a separately verified hub service identity and canonical user assertion.';

create table ops.consumer_hub_registry (
  hub_key text primary key
    check (hub_key in ('ask', 'move', 'lender', 'insurance', 'contractor', 'senior', 'investor')),
  issuer_id text not null unique,
  audience_id text not null unique,
  bff_service_identity text not null unique,
  database_role text not null unique,
  production_origins text[] not null,
  staging_origins text[] not null default '{}',
  development_origins text[] not null default '{}',
  allowed_return_prefixes text[] not null,
  allowed_scopes text[] not null,
  enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (cardinality(production_origins) > 0),
  check (cardinality(allowed_return_prefixes) > 0),
  check (cardinality(allowed_scopes) > 0)
);

insert into ops.consumer_hub_registry(
  hub_key, issuer_id, audience_id, bff_service_identity, database_role,
  production_origins, staging_origins, development_origins,
  allowed_return_prefixes, allowed_scopes
) values
('ask','urn:trusthub:ask','urn:trusthub:ask:bff','svc:trusthub:ask:bff:v1','myth_bff_ask',
 array['https://www.asktrusthub.com','https://asktrusthub.com'], '{}', array['http://localhost:3000'],
 array['/my','/consumer-lab'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']),
('move','urn:trusthub:move','urn:trusthub:move:bff','svc:trusthub:move:bff:v1','myth_bff_move',
 array['https://www.movetrusthub.com','https://movetrusthub.com'], '{}', array['http://localhost:3001'],
 array['/companies','/verify-dot','/moving-calculator','/my-move','/auth/network-handoff'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']),
('lender','urn:trusthub:lender','urn:trusthub:lender:bff','svc:trusthub:lender:bff:v1','myth_bff_lender',
 array['https://www.lendertrusthub.com','https://lendertrusthub.com'], '{}', array['http://localhost:3002'],
 array['/lenders','/local-lenders','/my-lending','/auth/network-handoff'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']),
('insurance','urn:trusthub:insurance','urn:trusthub:insurance:bff','svc:trusthub:insurance:bff:v1','myth_bff_insurance',
 array['https://www.insurancetrusthub.com','https://insurancetrusthub.com'], '{}', array['http://localhost:3003'],
 array['/directory','/companies','/my-insurance','/auth/network-handoff'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']),
('contractor','urn:trusthub:contractor','urn:trusthub:contractor:bff','svc:trusthub:contractor:bff:v1','myth_bff_contractor',
 array['https://www.contractortrusthub.com','https://contractortrusthub.com'], '{}', array['http://localhost:3004'],
 array['/contractors','/auth/network-handoff'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']),
('senior','urn:trusthub:senior','urn:trusthub:senior:bff','svc:trusthub:senior:bff:v1','myth_bff_senior',
 array['https://www.seniortrusthub.com','https://seniortrusthub.com'], '{}', array['http://localhost:3005'],
 array['/facilities','/providers','/auth/network-handoff'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']),
('investor','urn:trusthub:investor','urn:trusthub:investor:bff','svc:trusthub:investor:bff:v1','myth_bff_investor',
 array['https://www.investortrusthub.com','https://investortrusthub.com'], '{}', array['http://localhost:3006'],
 array['/firms','/advisers','/auth/network-handoff'], array['entity:read','saved:write','project:read','project:write','handoff:issue','handoff:consume']);

create trigger consumer_hub_registry_set_updated_at
before update on ops.consumer_hub_registry
for each row execute function network.set_updated_at();

create table ops.consumer_security_controls (
  control_key text primary key,
  available boolean not null,
  updated_at timestamptz not null default statement_timestamp()
);

insert into ops.consumer_security_controls(control_key, available)
values ('rate_limit', true);

create table ops.consumer_rate_limit_events (
  id bigint generated always as identity primary key,
  operation text not null check (operation in (
    'handoff_prepare', 'handoff_issue', 'handoff_consume',
    'identity_link_attempt', 'state_batch', 'saved_mutation', 'project_mutation'
  )),
  bucket_hash text not null check (bucket_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default statement_timestamp()
);

create index consumer_rate_limit_events_lookup_idx
  on ops.consumer_rate_limit_events(operation, bucket_hash, occurred_at desc);

create table ops.consumer_browser_handoff_intents (
  id uuid primary key default gen_random_uuid(),
  intent_kind text not null check (intent_kind in ('auth', 'context')),
  intent_code_hash text not null unique check (intent_code_hash ~ '^[a-f0-9]{64}$'),
  audience_hub text not null references ops.consumer_hub_registry(hub_key) on delete restrict,
  target_origin text not null,
  return_path text not null,
  browser_state_hash text not null check (browser_state_hash ~ '^[a-f0-9]{64}$'),
  nonce_hash text not null check (nonce_hash ~ '^[a-f0-9]{64}$'),
  environment text not null check (environment in ('production', 'staging', 'development')),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired', 'revoked')),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  check (expires_at > created_at and expires_at <= created_at + interval '120 seconds'),
  check ((status = 'consumed' and consumed_at is not null) or (status <> 'consumed'))
);

create index consumer_browser_handoff_intents_expiry_idx
  on ops.consumer_browser_handoff_intents(expires_at) where status = 'issued';
create index consumer_browser_handoff_intents_audience_idx
  on ops.consumer_browser_handoff_intents(audience_hub);

create table ops.consumer_auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references ops.consumer_browser_handoff_intents(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  canonical_user_id uuid not null references auth.users(id) on delete cascade,
  issuer_hub text not null references ops.consumer_hub_registry(hub_key) on delete restrict,
  audience_hub text not null references ops.consumer_hub_registry(hub_key) on delete restrict,
  initiating_origin text not null,
  target_origin text not null,
  return_path text not null,
  browser_state_hash text not null check (browser_state_hash ~ '^[a-f0-9]{64}$'),
  nonce_hash text not null check (nonce_hash ~ '^[a-f0-9]{64}$'),
  creation_key uuid not null,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired', 'revoked')),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  unique (canonical_user_id, issuer_hub, creation_key),
  check (issuer_hub <> audience_hub),
  check (expires_at > created_at and expires_at <= created_at + interval '120 seconds'),
  check ((status = 'consumed' and consumed_at is not null) or (status <> 'consumed'))
);

create index consumer_auth_handoffs_expiry_idx
  on ops.consumer_auth_handoffs(expires_at) where status = 'issued';
create index consumer_auth_handoffs_user_created_idx
  on ops.consumer_auth_handoffs(canonical_user_id, created_at desc);
create index consumer_auth_handoffs_issuer_idx
  on ops.consumer_auth_handoffs(issuer_hub);
create index consumer_auth_handoffs_audience_idx
  on ops.consumer_auth_handoffs(audience_hub);

create table ops.consumer_context_handoffs (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references ops.consumer_browser_handoff_intents(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  canonical_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references consumer.consumer_projects(id) on delete cascade,
  context_type text not null default 'project_ref' check (context_type = 'project_ref'),
  issuer_hub text not null default 'ask' check (issuer_hub = 'ask'),
  audience_hub text not null references ops.consumer_hub_registry(hub_key) on delete restrict,
  initiating_origin text not null,
  target_origin text not null,
  return_path text not null,
  payload jsonb not null default '{"include_location":false}'::jsonb,
  browser_state_hash text not null check (browser_state_hash ~ '^[a-f0-9]{64}$'),
  nonce_hash text not null check (nonce_hash ~ '^[a-f0-9]{64}$'),
  creation_key uuid not null,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired', 'revoked', 'cleared')),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  cleared_at timestamptz null,
  unique (canonical_user_id, audience_hub, creation_key),
  check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2048),
  check (expires_at > created_at and expires_at <= created_at + interval '120 seconds'),
  check ((status = 'consumed' and consumed_at is not null) or (status <> 'consumed')),
  check ((status = 'cleared' and cleared_at is not null) or (status <> 'cleared'))
);

create index consumer_context_handoffs_expiry_idx
  on ops.consumer_context_handoffs(expires_at) where status = 'issued';
create index consumer_context_handoffs_user_project_idx
  on ops.consumer_context_handoffs(canonical_user_id, project_id, created_at desc);
create index consumer_context_handoffs_project_idx
  on ops.consumer_context_handoffs(project_id);
create index consumer_context_handoffs_audience_idx
  on ops.consumer_context_handoffs(audience_hub);

create table ops.consumer_identity_link_attempts (
  id uuid primary key default gen_random_uuid(),
  canonical_user_id uuid not null references auth.users(id) on delete cascade,
  legacy_hub text not null check (legacy_hub in ('move','lender','insurance','contractor','senior','investor')),
  legacy_subject_namespace text not null,
  legacy_subject_id text not null,
  challenge_hash text not null unique check (challenge_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  verified_at timestamptz null,
  check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);

create index consumer_identity_link_attempts_legacy_idx
  on ops.consumer_identity_link_attempts(legacy_subject_namespace, legacy_subject_id, created_at desc);
create index consumer_identity_link_attempts_user_idx
  on ops.consumer_identity_link_attempts(canonical_user_id);

create table ops.consumer_handoff_events (
  id bigint generated always as identity primary key,
  handoff_kind text not null check (handoff_kind in ('intent','auth','context','identity_link')),
  handoff_ref uuid null,
  action text not null check (action in ('created','consumed','failed','expired','revoked','cleared')),
  reason_code text null,
  actor text not null default network.request_actor(),
  occurred_at timestamptz not null default statement_timestamp()
);

create index consumer_handoff_events_ref_idx
  on ops.consumer_handoff_events(handoff_kind, handoff_ref, occurred_at desc);

comment on table ops.consumer_auth_handoffs is
  'Canonical one-time auth handoffs. Only SHA-256 hashes are stored; raw codes, JWTs, refresh tokens, and canonical IDs never enter browser URLs.';
comment on table ops.consumer_context_handoffs is
  'Server-side Project context. The browser receives an opaque code, never Project ID, user ID, notes, or raw consumer state.';
comment on table ops.consumer_browser_handoff_intents is
  'Destination-prepared browser binding. State and nonce remain in the destination host session; only an opaque intent code crosses domains.';
comment on table ops.consumer_handoff_events is
  'Sanitized operational audit. It contains no raw code, state, nonce, token, Project payload, or URL query.';

create or replace function ops.hash_handoff_secret(p_secret text)
returns text
language plpgsql
immutable
security invoker
set search_path = pg_catalog, extensions
as $$
begin
  if char_length(coalesce(p_secret, '')) not between 32 and 512 then
    raise exception 'INVALID_STATE' using errcode = '22023';
  end if;
  return encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex');
end;
$$;

create or replace function ops.origin_allowed(p_hub text, p_origin text, p_environment text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, ops
as $$
  select exists (
    select 1
    from ops.consumer_hub_registry r
    where r.hub_key = p_hub and r.enabled
      and p_origin = lower(p_origin)
      and p_origin = any(case p_environment
        when 'production' then r.production_origins
        when 'staging' then r.staging_origins
        when 'development' then r.development_origins
        else array[]::text[] end)
  );
$$;

create or replace function ops.normalize_return_path(p_hub text, p_path text)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, ops
as $$
declare path_only text;
begin
  if char_length(coalesce(p_path, '')) not between 1 and 1024
    or p_path not like '/%'
    or p_path like '//%'
    or position(E'\\' in p_path) > 0
    or position('#' in p_path) > 0
    or p_path ~ '[[:cntrl:]]'
    or p_path ~* '%(25|2f|5c|3a|00|0a|0d)'
    or p_path ~* '(javascript|data|https?):' then
    raise exception 'RETURN_NOT_ALLOWED' using errcode = '22023';
  end if;
  path_only := split_part(p_path, '?', 1);
  if not exists (
    select 1 from ops.consumer_hub_registry r,
      unnest(r.allowed_return_prefixes) as allowed(prefix)
    where r.hub_key = p_hub and r.enabled
      and (path_only = allowed.prefix or path_only like allowed.prefix || '/%')
  ) then
    raise exception 'RETURN_NOT_ALLOWED' using errcode = '22023';
  end if;
  return p_path;
end;
$$;

create or replace function ops.consume_rate_limit(
  p_operation text,
  p_bucket_secret text,
  p_limit integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, ops
as $$
declare bucket text; recent_count integer;
begin
  if not coalesce((select available from ops.consumer_security_controls where control_key='rate_limit'), false) then
    raise exception 'RATE_LIMITED' using errcode = '55000';
  end if;
  if p_limit not between 1 and 100 or p_window <= interval '0 seconds' or p_window > interval '1 day' then
    raise exception 'RATE_LIMITED' using errcode = '22023';
  end if;
  bucket := ops.hash_handoff_secret(p_bucket_secret);
  perform pg_advisory_xact_lock(hashtextextended(p_operation || ':' || bucket, 0));
  select count(*) into recent_count
  from ops.consumer_rate_limit_events e
  where e.operation = p_operation and e.bucket_hash = bucket
    and e.occurred_at >= statement_timestamp() - p_window;
  if recent_count >= p_limit then
    raise exception 'RATE_LIMITED' using errcode = '54000';
  end if;
  insert into ops.consumer_rate_limit_events(operation, bucket_hash) values (p_operation, bucket);
exception
  when undefined_table then
    raise exception 'RATE_LIMITED' using errcode = '55000';
end;
$$;

create or replace function ops.valid_context_payload(p_payload jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select jsonb_typeof(p_payload)='object'
    and not exists (
      select 1 from jsonb_object_keys(p_payload) k(key)
      where k.key not in ('include_location')
    )
    and (not (p_payload ? 'include_location') or jsonb_typeof(p_payload->'include_location')='boolean');
$$;

create or replace function ops.create_browser_handoff_intent(
  p_intent_kind text,
  p_raw_intent_code text,
  p_audience_hub text,
  p_target_origin text,
  p_return_path text,
  p_raw_browser_state text,
  p_raw_nonce text,
  p_environment text,
  p_rate_bucket_secret text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ops
as $$
declare new_id uuid;
begin
  if p_intent_kind not in ('auth','context')
    or not ops.origin_allowed(p_audience_hub, p_target_origin, p_environment) then
    raise exception 'INVALID_AUDIENCE' using errcode = '22023';
  end if;
  perform ops.consume_rate_limit('handoff_prepare', p_rate_bucket_secret, 10, interval '1 minute');
  insert into ops.consumer_browser_handoff_intents(
    intent_kind, intent_code_hash, audience_hub, target_origin, return_path,
    browser_state_hash, nonce_hash, environment, expires_at
  ) values (
    p_intent_kind, ops.hash_handoff_secret(p_raw_intent_code), p_audience_hub,
    p_target_origin, ops.normalize_return_path(p_audience_hub, p_return_path),
    ops.hash_handoff_secret(p_raw_browser_state), ops.hash_handoff_secret(p_raw_nonce),
    p_environment, statement_timestamp() + interval '90 seconds'
  ) returning id into new_id;
  insert into ops.consumer_handoff_events(handoff_kind, handoff_ref, action)
  values ('intent', new_id, 'created');
  return new_id;
end;
$$;

create or replace function ops.resolve_linked_consumer(
  p_legacy_hub text,
  p_legacy_subject_namespace text,
  p_legacy_subject_id text
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, ops
as $$
  select l.canonical_user_id
  from ops.consumer_identity_links l
  where l.legacy_hub=p_legacy_hub
    and l.legacy_subject_namespace=p_legacy_subject_namespace
    and l.legacy_subject_id=p_legacy_subject_id
    and l.link_status='linked'
  limit 1;
$$;

create or replace function ops.create_consumer_auth_handoff(
  p_raw_code text,
  p_canonical_user_id uuid,
  p_issuer_hub text,
  p_initiating_origin text,
  p_raw_intent_code text,
  p_creation_key uuid,
  p_rate_bucket_secret text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ops, auth
as $$
declare intent ops.consumer_browser_handoff_intents%rowtype; new_id uuid;
begin
  perform ops.consume_rate_limit('handoff_issue', p_rate_bucket_secret, 10, interval '1 minute');
  if not exists(select 1 from auth.users where id=p_canonical_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into intent from ops.consumer_browser_handoff_intents
  where intent_code_hash=ops.hash_handoff_secret(p_raw_intent_code)
  for update;
  if not found or intent.intent_kind <> 'auth' or intent.status <> 'issued'
    or intent.expires_at <= statement_timestamp() then
    raise exception 'HANDOFF_EXPIRED' using errcode = '22023';
  end if;
  if p_issuer_hub=intent.audience_hub
    or not ops.origin_allowed(p_issuer_hub,p_initiating_origin,intent.environment) then
    raise exception 'INVALID_AUDIENCE' using errcode = '22023';
  end if;
  update ops.consumer_browser_handoff_intents
  set status='consumed', consumed_at=statement_timestamp() where id=intent.id;
  insert into ops.consumer_auth_handoffs(
    intent_id, code_hash, canonical_user_id, issuer_hub, audience_hub,
    initiating_origin, target_origin, return_path, browser_state_hash, nonce_hash,
    creation_key, expires_at
  ) values (
    intent.id, ops.hash_handoff_secret(p_raw_code), p_canonical_user_id,
    p_issuer_hub, intent.audience_hub, p_initiating_origin, intent.target_origin,
    intent.return_path, intent.browser_state_hash, intent.nonce_hash,
    p_creation_key, statement_timestamp()+interval '90 seconds'
  ) returning id into new_id;
  insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action)
  values ('auth',new_id,'created');
  return new_id;
end;
$$;

create or replace function ops.create_legacy_consumer_auth_handoff(
  p_raw_code text,
  p_legacy_hub text,
  p_legacy_subject_namespace text,
  p_legacy_subject_id text,
  p_initiating_origin text,
  p_raw_intent_code text,
  p_creation_key uuid,
  p_rate_bucket_secret text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ops
as $$
declare canonical_user uuid;
begin
  canonical_user := ops.resolve_linked_consumer(
    p_legacy_hub,p_legacy_subject_namespace,p_legacy_subject_id
  );
  if canonical_user is null then
    raise exception 'IDENTITY_LINK_REQUIRED' using errcode = '42501';
  end if;
  return ops.create_consumer_auth_handoff(
    p_raw_code,canonical_user,p_legacy_hub,p_initiating_origin,p_raw_intent_code,
    p_creation_key,p_rate_bucket_secret
  );
end;
$$;

create or replace function ops.consume_consumer_auth_handoff(
  p_raw_code text,
  p_expected_issuer_hub text,
  p_audience_hub text,
  p_target_origin text,
  p_raw_browser_state text,
  p_raw_nonce text,
  p_rate_bucket_secret text
)
returns table(
  ok boolean,
  error_code text,
  canonical_user_id uuid,
  return_path text,
  handoff_ref uuid
)
language plpgsql
security definer
set search_path = pg_catalog, ops
as $$
declare h ops.consumer_auth_handoffs%rowtype; failure text;
begin
  perform ops.consume_rate_limit('handoff_consume',p_rate_bucket_secret,30,interval '1 minute');
  select * into h from ops.consumer_auth_handoffs
  where code_hash=ops.hash_handoff_secret(p_raw_code) for update;
  if not found then
    return query select false,'INVALID_STATE'::text,null::uuid,null::text,null::uuid;
    return;
  end if;
  if h.status='consumed' then
    return query select false,'HANDOFF_ALREADY_USED'::text,null::uuid,null::text,h.id;
    return;
  end if;
  if h.status <> 'issued' then
    return query select false,'INVALID_STATE'::text,null::uuid,null::text,h.id;
    return;
  end if;
  if h.expires_at <= statement_timestamp() then
    update ops.consumer_auth_handoffs set status='expired' where id=h.id;
    insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action,reason_code)
    values ('auth',h.id,'expired','HANDOFF_EXPIRED');
    return query select false,'HANDOFF_EXPIRED'::text,null::uuid,null::text,h.id;
    return;
  end if;
  if h.issuer_hub<>p_expected_issuer_hub or h.audience_hub<>p_audience_hub
    or h.target_origin<>p_target_origin then
    failure := 'INVALID_AUDIENCE';
  elsif h.browser_state_hash<>ops.hash_handoff_secret(p_raw_browser_state)
    or h.nonce_hash<>ops.hash_handoff_secret(p_raw_nonce) then
    failure := 'INVALID_STATE';
  end if;
  if failure is not null then
    update ops.consumer_auth_handoffs
    set failed_attempts=least(failed_attempts+1,5),
        status=case when failed_attempts+1>=5 then 'revoked' else status end
    where id=h.id;
    insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action,reason_code)
    values ('auth',h.id,'failed',failure);
    return query select false,failure,null::uuid,null::text,h.id;
    return;
  end if;
  update ops.consumer_auth_handoffs
  set status='consumed',consumed_at=statement_timestamp() where id=h.id;
  insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action)
  values ('auth',h.id,'consumed');
  return query select true,null::text,h.canonical_user_id,h.return_path,h.id;
end;
$$;

create or replace function ops.create_consumer_context_handoff(
  p_raw_code text,
  p_canonical_user_id uuid,
  p_project_id uuid,
  p_initiating_origin text,
  p_raw_intent_code text,
  p_payload jsonb,
  p_creation_key uuid,
  p_rate_bucket_secret text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ops, consumer
as $$
declare intent ops.consumer_browser_handoff_intents%rowtype; new_id uuid;
begin
  perform ops.consume_rate_limit('handoff_issue',p_rate_bucket_secret,10,interval '1 minute');
  if not exists(select 1 from consumer.consumer_projects p where p.id=p_project_id and p.user_id=p_canonical_user_id)
    or not ops.valid_context_payload(coalesce(p_payload,'{"include_location":false}'::jsonb)) then
    raise exception 'INVALID_STATE' using errcode = '42501';
  end if;
  select * into intent from ops.consumer_browser_handoff_intents
  where intent_code_hash=ops.hash_handoff_secret(p_raw_intent_code) for update;
  if not found or intent.intent_kind<>'context' or intent.status<>'issued'
    or intent.expires_at<=statement_timestamp() then
    raise exception 'HANDOFF_EXPIRED' using errcode = '22023';
  end if;
  if intent.audience_hub='ask'
    or not ops.origin_allowed('ask',p_initiating_origin,intent.environment) then
    raise exception 'INVALID_AUDIENCE' using errcode = '22023';
  end if;
  update ops.consumer_browser_handoff_intents
  set status='consumed',consumed_at=statement_timestamp() where id=intent.id;
  insert into ops.consumer_context_handoffs(
    intent_id,code_hash,canonical_user_id,project_id,audience_hub,
    initiating_origin,target_origin,return_path,payload,browser_state_hash,nonce_hash,
    creation_key,expires_at
  ) values (
    intent.id,ops.hash_handoff_secret(p_raw_code),p_canonical_user_id,p_project_id,
    intent.audience_hub,p_initiating_origin,intent.target_origin,intent.return_path,
    coalesce(p_payload,'{"include_location":false}'::jsonb),intent.browser_state_hash,
    intent.nonce_hash,p_creation_key,statement_timestamp()+interval '90 seconds'
  ) returning id into new_id;
  insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action)
  values ('context',new_id,'created');
  return new_id;
end;
$$;

create or replace function ops.consume_consumer_context_handoff(
  p_raw_code text,
  p_canonical_user_id uuid,
  p_audience_hub text,
  p_target_origin text,
  p_raw_browser_state text,
  p_raw_nonce text,
  p_rate_bucket_secret text
)
returns table(
  ok boolean,
  error_code text,
  context_ref uuid,
  project_name text,
  location_context jsonb,
  return_path text
)
language plpgsql
security definer
set search_path = pg_catalog, ops, consumer
as $$
declare h ops.consumer_context_handoffs%rowtype; p consumer.consumer_projects%rowtype; failure text;
begin
  perform ops.consume_rate_limit('handoff_consume',p_rate_bucket_secret,30,interval '1 minute');
  select * into h from ops.consumer_context_handoffs
  where code_hash=ops.hash_handoff_secret(p_raw_code) for update;
  if not found then
    return query select false,'INVALID_STATE'::text,null::uuid,null::text,null::jsonb,null::text;
    return;
  end if;
  if h.status='consumed' then
    return query select false,'HANDOFF_ALREADY_USED'::text,h.id,null::text,null::jsonb,null::text;
    return;
  end if;
  if h.status<>'issued' then
    return query select false,'INVALID_STATE'::text,h.id,null::text,null::jsonb,null::text;
    return;
  end if;
  if h.expires_at<=statement_timestamp() then
    update ops.consumer_context_handoffs set status='expired' where id=h.id;
    insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action,reason_code)
    values ('context',h.id,'expired','HANDOFF_EXPIRED');
    return query select false,'HANDOFF_EXPIRED'::text,h.id,null::text,null::jsonb,null::text;
    return;
  end if;
  if h.canonical_user_id<>p_canonical_user_id then failure:='INVALID_STATE';
  elsif h.audience_hub<>p_audience_hub or h.target_origin<>p_target_origin then failure:='INVALID_AUDIENCE';
  elsif h.browser_state_hash<>ops.hash_handoff_secret(p_raw_browser_state)
    or h.nonce_hash<>ops.hash_handoff_secret(p_raw_nonce) then failure:='INVALID_STATE';
  end if;
  if failure is not null then
    update ops.consumer_context_handoffs
    set failed_attempts=least(failed_attempts+1,5),
      status=case when failed_attempts+1>=5 then 'revoked' else status end
    where id=h.id;
    insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action,reason_code)
    values ('context',h.id,'failed',failure);
    return query select false,failure,h.id,null::text,null::jsonb,null::text;
    return;
  end if;
  select * into p from consumer.consumer_projects where id=h.project_id and user_id=h.canonical_user_id;
  if not found then
    return query select false,'INVALID_STATE'::text,h.id,null::text,null::jsonb,null::text;
    return;
  end if;
  update ops.consumer_context_handoffs
  set status='consumed',consumed_at=statement_timestamp() where id=h.id;
  insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action)
  values ('context',h.id,'consumed');
  return query select true,null::text,h.id,p.name,
    case when coalesce((h.payload->>'include_location')::boolean,false) then p.location_context else null end,
    h.return_path;
end;
$$;

create or replace function ops.clear_consumer_context(
  p_context_ref uuid,
  p_canonical_user_id uuid,
  p_audience_hub text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, ops
as $$
declare affected integer;
begin
  update ops.consumer_context_handoffs
  set status='cleared',cleared_at=statement_timestamp()
  where id=p_context_ref and canonical_user_id=p_canonical_user_id
    and audience_hub=p_audience_hub and status in ('issued','consumed');
  get diagnostics affected=row_count;
  if affected=1 then
    insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action)
    values ('context',p_context_ref,'cleared');
  end if;
  return affected=1;
end;
$$;

create or replace function ops.start_consumer_identity_link_attempt(
  p_canonical_user_id uuid,
  p_legacy_hub text,
  p_legacy_subject_namespace text,
  p_legacy_subject_id text,
  p_raw_challenge text,
  p_rate_bucket_secret text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ops, auth
as $$
declare new_id uuid;
begin
  perform ops.consume_rate_limit('identity_link_attempt',p_rate_bucket_secret,5,interval '15 minutes');
  if not exists(select 1 from auth.users where id=p_canonical_user_id) then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  insert into ops.consumer_identity_link_attempts(
    canonical_user_id,legacy_hub,legacy_subject_namespace,legacy_subject_id,
    challenge_hash,expires_at
  ) values (
    p_canonical_user_id,p_legacy_hub,p_legacy_subject_namespace,p_legacy_subject_id,
    ops.hash_handoff_secret(p_raw_challenge),statement_timestamp()+interval '10 minutes'
  ) returning id into new_id;
  insert into ops.consumer_handoff_events(handoff_kind,handoff_ref,action)
  values ('identity_link',new_id,'created');
  return new_id;
end;
$$;

create or replace function ops.assert_bff_scope(p_hub text,p_scope text)
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog, ops
as $$
begin
  if not exists(
    select 1 from ops.consumer_hub_registry r
    where r.hub_key=p_hub and r.database_role=current_user
      and r.enabled and p_scope=any(r.allowed_scopes)
  ) then
    raise exception 'INVALID_AUDIENCE' using errcode='42501';
  end if;
  return true;
end;
$$;

create or replace function consumer.get_cross_hub_entity_state(p_network_entity_id uuid)
returns table(
  network_entity_id uuid,
  canonical_name text,
  canonical_public_profile_ref text,
  saved boolean,
  saved_entity_id uuid,
  identity_resolution_state text,
  projects jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, consumer, network
as $$
declare subject uuid:=consumer.require_user(); canonical uuid; matching integer; saved_row consumer.consumer_saved_entities%rowtype;
begin
  canonical:=network.resolve_canonical_entity(p_network_entity_id);
  if canonical is null or not exists(select 1 from network.network_entities e where e.id=canonical and e.status in ('active','review_required')) then
    raise exception 'ENTITY_UNRESOLVED' using errcode='22023';
  end if;
  select count(*) into matching from consumer.consumer_saved_entities s
  where s.user_id=subject and s.removed_at is null
    and network.resolve_canonical_entity(s.network_entity_id)=canonical;
  if matching>1 then raise exception 'SAVE_CONFLICT' using errcode='23000'; end if;
  select * into saved_row from consumer.consumer_saved_entities s
  where s.user_id=subject and s.removed_at is null
    and network.resolve_canonical_entity(s.network_entity_id)=canonical limit 1;
  return query
  select e.id,e.canonical_name,e.canonical_public_profile_ref,
    saved_row.id is not null,saved_row.id,saved_row.identity_resolution_state,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'project_ref',p.id,'name',p.name,'status',p.status,'life_event_type',p.life_event_type
      ) order by p.updated_at desc)
      from consumer.consumer_project_saved_entities m
      join consumer.consumer_projects p on p.id=m.project_id
      where m.saved_entity_id=saved_row.id and m.removed_at is null and p.user_id=subject
    ),'[]'::jsonb)
  from network.network_entities e where e.id=canonical;
end;
$$;

create or replace function consumer.get_cross_hub_entity_states_batch(p_network_entity_ids uuid[])
returns table(
  network_entity_id uuid,
  canonical_name text,
  canonical_public_profile_ref text,
  saved boolean,
  saved_entity_id uuid,
  identity_resolution_state text,
  projects jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, consumer
as $$
declare entity_id uuid;
begin
  perform consumer.require_user();
  if coalesce(cardinality(p_network_entity_ids),0) not between 1 and 50 then
    raise exception 'RATE_LIMITED' using errcode='54000';
  end if;
  foreach entity_id in array p_network_entity_ids loop
    return query select * from consumer.get_cross_hub_entity_state(entity_id);
  end loop;
end;
$$;

create or replace function consumer.list_cross_hub_project_summaries(p_limit integer default 25)
returns table(project_id uuid,name text,status text,life_event_type text)
language plpgsql
stable
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid:=consumer.require_user();
begin
  if p_limit not between 1 and 50 then raise exception 'RATE_LIMITED' using errcode='54000'; end if;
  return query select p.id,p.name,p.status,p.life_event_type
  from consumer.consumer_projects p where p.user_id=subject
  order by p.updated_at desc limit p_limit;
end;
$$;

-- P13 tables are inaccessible to browsers even if a future API route is misconfigured.
alter table ops.consumer_hub_registry enable row level security;
alter table ops.consumer_hub_registry force row level security;
alter table ops.consumer_security_controls enable row level security;
alter table ops.consumer_security_controls force row level security;
alter table ops.consumer_rate_limit_events enable row level security;
alter table ops.consumer_rate_limit_events force row level security;
alter table ops.consumer_browser_handoff_intents enable row level security;
alter table ops.consumer_browser_handoff_intents force row level security;
alter table ops.consumer_auth_handoffs enable row level security;
alter table ops.consumer_auth_handoffs force row level security;
alter table ops.consumer_context_handoffs enable row level security;
alter table ops.consumer_context_handoffs force row level security;
alter table ops.consumer_identity_link_attempts enable row level security;
alter table ops.consumer_identity_link_attempts force row level security;
alter table ops.consumer_handoff_events enable row level security;
alter table ops.consumer_handoff_events force row level security;

create policy consumer_hub_registry_bff_own
on ops.consumer_hub_registry for select
to myth_bff_ask,myth_bff_move,myth_bff_lender,myth_bff_insurance,
   myth_bff_contractor,myth_bff_senior,myth_bff_investor
using (database_role=current_user);

create policy consumer_hub_registry_broker_read
on ops.consumer_hub_registry for select to myth_handoff_broker
using (true);

revoke all on schema ops from anon, authenticated;
revoke all on all tables in schema ops from anon, authenticated;
revoke all on all functions in schema ops from anon, authenticated;

grant usage on schema ops to myth_handoff_broker;
grant select on ops.consumer_hub_registry to myth_handoff_broker;
grant execute on function ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text) to myth_handoff_broker;
grant execute on function ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text) to myth_handoff_broker;
grant execute on function ops.create_legacy_consumer_auth_handoff(text,text,text,text,text,text,uuid,text) to myth_handoff_broker;
grant execute on function ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text) to myth_handoff_broker;
grant execute on function ops.create_consumer_context_handoff(text,uuid,uuid,text,text,jsonb,uuid,text) to myth_handoff_broker;
grant execute on function ops.consume_consumer_context_handoff(text,uuid,text,text,text,text,text) to myth_handoff_broker;
grant execute on function ops.clear_consumer_context(uuid,uuid,text) to myth_handoff_broker;
grant execute on function ops.resolve_linked_consumer(text,text,text) to myth_handoff_broker;
grant execute on function ops.start_consumer_identity_link_attempt(uuid,text,text,text,text,text) to myth_handoff_broker;

grant usage on schema consumer to myth_consumer_api;
grant execute on function consumer.get_cross_hub_entity_state(uuid) to authenticated,myth_consumer_api;
grant execute on function consumer.get_cross_hub_entity_states_batch(uuid[]) to authenticated,myth_consumer_api;
grant execute on function consumer.list_cross_hub_project_summaries(integer) to authenticated,myth_consumer_api;

grant usage on schema ops to myth_bff_ask,myth_bff_move,myth_bff_lender,myth_bff_insurance,
  myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant select on ops.consumer_hub_registry to myth_bff_ask,myth_bff_move,myth_bff_lender,
  myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant execute on function ops.assert_bff_scope(text,text) to myth_bff_ask,myth_bff_move,
  myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

revoke all on function ops.hash_handoff_secret(text) from public;
revoke all on function ops.origin_allowed(text,text,text) from public;
revoke all on function ops.normalize_return_path(text,text) from public;
revoke all on function ops.consume_rate_limit(text,text,integer,interval) from public;
revoke all on function ops.valid_context_payload(jsonb) from public;
revoke all on function ops.create_browser_handoff_intent(text,text,text,text,text,text,text,text,text) from public;
revoke all on function ops.resolve_linked_consumer(text,text,text) from public;
revoke all on function ops.create_consumer_auth_handoff(text,uuid,text,text,text,uuid,text) from public;
revoke all on function ops.create_legacy_consumer_auth_handoff(text,text,text,text,text,text,uuid,text) from public;
revoke all on function ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text) from public;
revoke all on function ops.create_consumer_context_handoff(text,uuid,uuid,text,text,jsonb,uuid,text) from public;
revoke all on function ops.consume_consumer_context_handoff(text,uuid,text,text,text,text,text) from public;
revoke all on function ops.clear_consumer_context(uuid,uuid,text) from public;
revoke all on function ops.start_consumer_identity_link_attempt(uuid,text,text,text,text,text) from public;
revoke all on function ops.assert_bff_scope(text,text) from public;
revoke all on function consumer.get_cross_hub_entity_state(uuid) from public;
revoke all on function consumer.get_cross_hub_entity_states_batch(uuid[]) from public;
revoke all on function consumer.list_cross_hub_project_summaries(integer) from public;

commit;
