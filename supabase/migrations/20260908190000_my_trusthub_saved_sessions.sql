-- My TrustHub P18: versioned Saved comparison/tool/session envelopes.
-- Apply only after P11-P17. No specialist computation, Watch, Alert, delivery,
-- decision, export, or production adapter is created here.

begin;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='myth_session_governor') then
    create role myth_session_governor nologin noinherit;
  end if;
end;
$$;

comment on role myth_session_governor is
  'Parent-only governor for consumer session schema approval, retirement, and migration-adapter approval.';

create table network.consumer_session_schemas (
  id uuid primary key default gen_random_uuid(),
  schema_key text not null check(schema_key ~ '^[a-z][a-z0-9_-]+\.[a-z][a-z0-9_-]+/v[1-9][0-9]*$'),
  version integer not null check(version between 1 and 1000),
  hub text not null check(hub in ('move','lender','insurance','contractor','senior','investor')),
  session_type text not null check(session_type in ('comparison','calculator','plan','worksheet','inventory')),
  status text not null check(status in ('draft','approved','deprecated','retired')),
  max_payload_bytes integer not null default 65536 check(max_payload_bytes between 1024 and 262144),
  payload_allowed_keys text[] not null,
  payload_required_keys text[] not null default '{}',
  summary_allowed_keys text[] not null,
  summary_version integer not null default 1 check(summary_version between 1 and 100),
  resume_kind text not null check(resume_kind in ('comparison','calculator','plan','worksheet','inventory')),
  resume_route_key text not null check(resume_route_key ~ '^/[a-z0-9/_-]+$'),
  data_classification text not null check(data_classification in ('non_sensitive','restricted_financial','restricted_household')),
  sensitive_field_policy text not null check(char_length(btrim(sensitive_field_policy)) between 10 and 1000),
  retention_policy text not null check(char_length(btrim(retention_policy)) between 10 and 1000),
  effective_from timestamptz not null default statement_timestamp(),
  effective_to timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(schema_key,version),
  unique(schema_key,version,hub,session_type),
  check(cardinality(payload_allowed_keys) between 1 and 100),
  check(payload_required_keys <@ payload_allowed_keys),
  check(cardinality(summary_allowed_keys) between 1 and 30),
  check(effective_to is null or effective_to>effective_from)
);

create index consumer_session_schemas_lookup_idx
  on network.consumer_session_schemas(hub,session_type,status,effective_from,effective_to);

create trigger consumer_session_schemas_set_updated_at
before update on network.consumer_session_schemas
for each row execute function network.set_updated_at();

create table network.consumer_session_schema_migrations (
  id uuid primary key default gen_random_uuid(),
  from_schema_id uuid not null references network.consumer_session_schemas(id) on delete restrict,
  to_schema_id uuid not null references network.consumer_session_schemas(id) on delete restrict,
  hub text not null check(hub in ('move','lender','insurance','contractor','senior','investor')),
  adapter_key text not null check(adapter_key ~ '^[a-z][a-z0-9_.-]+/v[1-9][0-9]*$'),
  status text not null check(status in ('draft','approved','disabled')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(from_schema_id,to_schema_id),
  check(from_schema_id<>to_schema_id)
);

create index consumer_session_schema_migrations_from_idx
  on network.consumer_session_schema_migrations(from_schema_id,status);
create index consumer_session_schema_migrations_to_idx
  on network.consumer_session_schema_migrations(to_schema_id);

create trigger consumer_session_schema_migrations_set_updated_at
before update on network.consumer_session_schema_migrations
for each row execute function network.set_updated_at();

create table consumer.consumer_saved_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hub text not null check(hub in ('move','lender','insurance','contractor','senior','investor')),
  session_type text not null check(session_type in ('comparison','calculator','plan','worksheet','inventory')),
  schema_key text not null,
  schema_version integer not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  payload_fingerprint text not null check(payload_fingerprint ~ '^[a-f0-9]{64}$'),
  summary jsonb not null check(jsonb_typeof(summary)='object'),
  resume_ref uuid not null default gen_random_uuid() unique,
  status text not null default 'active' check(status in ('active','archived','read_only','invalidated')),
  create_idempotency_key uuid not null,
  guest_origin_key text null check(guest_origin_key is null or char_length(guest_origin_key) between 1 and 128),
  copied_from_session_id uuid null references consumer.consumer_saved_sessions(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  last_resumed_at timestamptz null,
  archived_at timestamptz null,
  row_version bigint not null default 1 check(row_version>0),
  foreign key(schema_key,schema_version,hub,session_type)
    references network.consumer_session_schemas(schema_key,version,hub,session_type) on delete restrict,
  unique(user_id,create_idempotency_key),
  unique(user_id,hub,guest_origin_key),
  check((status='archived' and archived_at is not null) or status<>'archived')
);

create index consumer_saved_sessions_user_activity_idx
  on consumer.consumer_saved_sessions(user_id,status,
    coalesce(last_resumed_at,updated_at,created_at) desc);
create index consumer_saved_sessions_schema_idx
  on consumer.consumer_saved_sessions(schema_key,schema_version,status);
create index consumer_saved_sessions_schema_contract_idx
  on consumer.consumer_saved_sessions(schema_key,schema_version,hub,session_type);
create index consumer_saved_sessions_user_hub_idx
  on consumer.consumer_saved_sessions(user_id,hub,session_type);
create index consumer_saved_sessions_copied_from_idx
  on consumer.consumer_saved_sessions(copied_from_session_id)
  where copied_from_session_id is not null;

comment on table consumer.consumer_saved_sessions is
  'Parent-owned ownership/lifecycle envelope. Payload meaning and migration adapters remain specialist-owned.';

create trigger consumer_saved_sessions_set_updated_at
before update on consumer.consumer_saved_sessions
for each row execute function network.set_updated_at();

create table consumer.consumer_project_saved_sessions (
  project_id uuid not null references consumer.consumer_projects(id) on delete cascade,
  saved_session_id uuid not null references consumer.consumer_saved_sessions(id) on delete cascade,
  added_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz null,
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check(row_version>0),
  primary key(project_id,saved_session_id)
);

create index consumer_project_saved_sessions_session_idx
  on consumer.consumer_project_saved_sessions(saved_session_id,project_id)
  where removed_at is null;
create index consumer_project_saved_sessions_project_idx
  on consumer.consumer_project_saved_sessions(project_id,added_at desc)
  where removed_at is null;

create trigger consumer_project_saved_sessions_set_updated_at
before update on consumer.consumer_project_saved_sessions
for each row execute function network.set_updated_at();

create table consumer.consumer_session_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_session_id uuid not null references consumer.consumer_saved_sessions(id) on delete cascade,
  event_type text not null check(event_type in (
    'saved','updated','resumed','archived','restored','read_only','invalidated',
    'project_added','project_removed','schema_migrated'
  )),
  idempotency_key uuid null,
  request_fingerprint text null check(request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{64}$'),
  resulting_row_version bigint null,
  created_at timestamptz not null default statement_timestamp(),
  unique(user_id,idempotency_key)
);

create index consumer_session_events_session_time_idx
  on consumer.consumer_session_events(saved_session_id,created_at desc);

create table ops.consumer_session_resume_handoffs (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
  canonical_user_id uuid not null references auth.users(id) on delete cascade,
  saved_session_id uuid not null references consumer.consumer_saved_sessions(id) on delete cascade,
  target_hub text not null check(target_hub in ('move','lender','insurance','contractor','senior','investor')),
  return_path text not null,
  browser_state_hash text not null check(browser_state_hash ~ '^[a-f0-9]{64}$'),
  nonce_hash text not null check(nonce_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'issued' check(status in ('issued','consumed','expired','revoked')),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  failed_attempts integer not null default 0 check(failed_attempts between 0 and 5),
  check(expires_at<=created_at+interval '2 minutes')
);

create index consumer_session_resume_handoffs_expiry_idx
  on ops.consumer_session_resume_handoffs(expires_at) where status='issued';
create index consumer_session_resume_handoffs_user_idx
  on ops.consumer_session_resume_handoffs(canonical_user_id);
create index consumer_session_resume_handoffs_session_idx
  on ops.consumer_session_resume_handoffs(saved_session_id);

create table consumer.consumer_guest_session_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_version text not null check(import_version='mytrusthub-guest-sessions/v1'),
  idempotency_key uuid not null,
  request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  submitted_item_count integer not null check(submitted_item_count>=0),
  imported_item_count integer not null default 0 check(imported_item_count>=0),
  duplicate_item_count integer not null default 0 check(duplicate_item_count>=0),
  rejected_item_count integer not null default 0 check(rejected_item_count>=0),
  status text not null default 'processing' check(status in ('processing','completed')),
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz null,
  unique(user_id,idempotency_key)
);

create index consumer_guest_session_imports_user_time_idx
  on consumer.consumer_guest_session_imports(user_id,created_at desc);

create table consumer.consumer_guest_session_import_items (
  import_id uuid not null references consumer.consumer_guest_session_imports(id) on delete cascade,
  client_item_id text not null check(char_length(client_item_id) between 1 and 100),
  selected boolean not null,
  result_status text not null check(result_status in ('imported','duplicate','rejected','not_selected')),
  preview_status text not null check(preview_status in (
    'valid','duplicate','unsupported_version','expired','invalid','oversized'
  )),
  saved_session_id uuid null references consumer.consumer_saved_sessions(id) on delete set null,
  project_id uuid null references consumer.consumer_projects(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(import_id,client_item_id)
);

create index consumer_guest_session_import_items_session_idx
  on consumer.consumer_guest_session_import_items(saved_session_id)
  where saved_session_id is not null;
create index consumer_guest_session_import_items_project_idx
  on consumer.consumer_guest_session_import_items(project_id)
  where project_id is not null;

-- Recursive key screening applies to both payloads and summaries. This is a
-- denylist safety boundary in addition to each schema's positive top-level allowlist.
create or replace function consumer.session_json_has_prohibited_content(p_value jsonb)
returns boolean
language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare k text; v jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for k,v in select key,value from jsonb_each(p_value) loop
      if lower(k) ~ '(^|_)(access_token|accesstoken|refresh_token|refreshtoken|auth_token|authtoken|jwt|password|passwd|secret|api_key|apikey|service_key|servicekey|ssn|social_security|socialsecurity|bank_account|bankaccount|routing_number|routingnumber|account_number|accountnumber|credit_card|creditcard|card_number|cardnumber|cvv|diagnosis|medical_record|medicalrecord|brokerage_credentials|brokeragecredentials|trading_authorization|tradingauthorization)($|_)'
        or consumer.session_json_has_prohibited_content(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v in select value from jsonb_array_elements(p_value) loop
      if consumer.session_json_has_prohibited_content(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(p_value)='string' then
    if p_value#>>'{}' ~* '(<script|javascript:|data:text/html|-----begin [a-z ]*private key-----)'
      then return true; end if;
    if char_length(p_value#>>'{}')>4096 and p_value#>>'{}' ~ '^[A-Za-z0-9+/=[:space:]]+$'
      then return true; end if;
  end if;
  return false;
end;
$$;

revoke all on function consumer.session_json_has_prohibited_content(jsonb) from public;

create or replace function consumer.assert_session_actor(p_hub text,p_scope text)
returns void
language plpgsql stable security definer set search_path=pg_catalog,ops as $$
declare actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); subject uuid:=consumer.require_user();
begin
  if not exists(select 1 from consumer.consumer_profiles p where p.user_id=subject) then
    raise exception 'AUTH_REQUIRED' using errcode='insufficient_privilege';
  end if;
  if actor='authenticated' or actor='myth_consumer_api' then return; end if;
  if not exists(
    select 1 from ops.consumer_hub_registry r
    where r.hub_key=p_hub and r.database_role=actor and r.enabled and p_scope=any(r.allowed_scopes)
  ) then raise exception 'INVALID_AUDIENCE' using errcode='insufficient_privilege'; end if;
end;
$$;

revoke all on function consumer.assert_session_actor(text,text) from public;

create or replace function consumer.validate_saved_session_content(
  p_hub text,p_session_type text,p_schema_key text,p_schema_version integer,
  p_payload jsonb,p_summary jsonb,p_for_new boolean default true
)
returns uuid
language plpgsql stable security definer set search_path=pg_catalog,network,consumer as $$
declare s network.consumer_session_schemas%rowtype; k text;
begin
  select * into s from network.consumer_session_schemas x
  where x.schema_key=p_schema_key and x.version=p_schema_version
    and x.hub=p_hub and x.session_type=p_session_type;
  if s.id is null then raise exception 'SESSION_SCHEMA_UNSUPPORTED' using errcode='22023'; end if;
  if p_for_new and s.status<>'approved' then raise exception 'SESSION_SCHEMA_NOT_CREATABLE' using errcode='22023'; end if;
  if not p_for_new and s.status not in ('approved','deprecated') then raise exception 'SESSION_SCHEMA_NOT_RESUMABLE' using errcode='22023'; end if;
  if statement_timestamp()<s.effective_from or (s.effective_to is not null and statement_timestamp()>=s.effective_to) then
    raise exception 'SESSION_SCHEMA_OUTSIDE_EFFECTIVE_WINDOW' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>s.max_payload_bytes then
    raise exception 'SESSION_PAYLOAD_INVALID_OR_OVERSIZED' using errcode='program_limit_exceeded';
  end if;
  if consumer.session_json_has_prohibited_content(p_payload) then
    raise exception 'SESSION_PAYLOAD_PROHIBITED_CONTENT' using errcode='check_violation';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) x(key) where not(x.key=any(s.payload_allowed_keys)))
    or exists(select 1 from unnest(s.payload_required_keys) x(key) where not(p_payload?x.key)) then
    raise exception 'SESSION_PAYLOAD_SCHEMA_INVALID' using errcode='check_violation';
  end if;
  if jsonb_typeof(p_summary)<>'object' or octet_length(p_summary::text)>2048
    or consumer.session_json_has_prohibited_content(p_summary)
    or exists(select 1 from jsonb_object_keys(p_summary) x(key) where not(x.key=any(s.summary_allowed_keys))) then
    raise exception 'SESSION_SUMMARY_INVALID' using errcode='check_violation';
  end if;
  for k in select key from jsonb_object_keys(p_summary) x(key) loop
    if jsonb_typeof(p_summary->k) not in ('string','number','boolean','null')
      or (jsonb_typeof(p_summary->k)='string' and char_length(p_summary->>k)>240) then
      raise exception 'SESSION_SUMMARY_INVALID' using errcode='check_violation';
    end if;
  end loop;
  return s.id;
end;
$$;

revoke all on function consumer.validate_saved_session_content(text,text,text,integer,jsonb,jsonb,boolean) from public;

create or replace function consumer.enforce_saved_session_membership_ownership()
returns trigger
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare project_user uuid; session_user_id uuid;
begin
  select user_id into project_user from consumer.consumer_projects where id=new.project_id;
  select user_id into session_user_id from consumer.consumer_saved_sessions where id=new.saved_session_id;
  if project_user is null or session_user_id is null or project_user<>session_user_id then
    raise exception 'SESSION_PROJECT_OWNERSHIP_MISMATCH' using errcode='integrity_constraint_violation';
  end if;
  return new;
end;
$$;

revoke all on function consumer.enforce_saved_session_membership_ownership() from public;

create trigger consumer_project_saved_sessions_ownership
before insert or update on consumer.consumer_project_saved_sessions
for each row execute function consumer.enforce_saved_session_membership_ownership();

create or replace function network.propose_consumer_session_schema(
  p_schema_key text,p_version integer,p_hub text,p_session_type text,p_max_payload_bytes integer,
  p_payload_allowed_keys text[],p_payload_required_keys text[],p_summary_allowed_keys text[],
  p_resume_kind text,p_resume_route_key text,p_data_classification text,
  p_sensitive_field_policy text,p_retention_policy text
)
returns uuid
language plpgsql security definer set search_path=pg_catalog,network,ops as $$
declare actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); new_id uuid;
begin
  if not exists(select 1 from ops.consumer_hub_registry r where r.hub_key=p_hub and r.database_role=actor and r.enabled) then
    raise exception 'SESSION_SCHEMA_PROPOSER_NOT_AUTHORIZED' using errcode='insufficient_privilege';
  end if;
  perform ops.normalize_return_path(p_hub,p_resume_route_key);
  insert into network.consumer_session_schemas(
    schema_key,version,hub,session_type,status,max_payload_bytes,payload_allowed_keys,
    payload_required_keys,summary_allowed_keys,resume_kind,resume_route_key,data_classification,
    sensitive_field_policy,retention_policy
  ) values(
    p_schema_key,p_version,p_hub,p_session_type,'draft',p_max_payload_bytes,p_payload_allowed_keys,
    p_payload_required_keys,p_summary_allowed_keys,p_resume_kind,p_resume_route_key,p_data_classification,
    p_sensitive_field_policy,p_retention_policy
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function network.set_consumer_session_schema_status(
  p_schema_key text,p_version integer,p_status text
)
returns uuid
language plpgsql security definer set search_path=pg_catalog,network,consumer as $$
declare actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); schema_id uuid; current_status text;
begin
  if actor<>'myth_session_governor' then raise exception 'SESSION_GOVERNOR_REQUIRED' using errcode='insufficient_privilege'; end if;
  if p_status not in ('draft','approved','deprecated','retired') then raise exception 'invalid schema status' using errcode='22023'; end if;
  select id,status into schema_id,current_status from network.consumer_session_schemas s
  where s.schema_key=p_schema_key and s.version=p_version for update;
  if schema_id is null then raise exception 'SESSION_SCHEMA_UNSUPPORTED' using errcode='no_data_found'; end if;
  if current_status='retired' and p_status<>'retired'
    or current_status='deprecated' and p_status not in ('deprecated','retired')
    or current_status='approved' and p_status='draft' then
    raise exception 'SESSION_SCHEMA_STATUS_TRANSITION_INVALID' using errcode='object_not_in_prerequisite_state';
  end if;
  update network.consumer_session_schemas s set status=p_status
  where s.id=schema_id;
  if p_status='retired' then
    update consumer.consumer_saved_sessions ss set status='read_only',row_version=row_version+1
    where ss.schema_key=p_schema_key and ss.schema_version=p_version
      and ss.status in ('active','archived')
      and not exists(
        select 1 from network.consumer_session_schema_migrations m
        where m.from_schema_id=schema_id and m.status='approved'
      );
  end if;
  return schema_id;
end;
$$;

create or replace function network.register_consumer_session_schema_migration(
  p_from_schema_id uuid,p_to_schema_id uuid,p_adapter_key text,p_status text
)
returns uuid
language plpgsql security definer set search_path=pg_catalog,network as $$
declare actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); result_id uuid; source_hub text; target_hub text;
begin
  if actor<>'myth_session_governor' then raise exception 'SESSION_GOVERNOR_REQUIRED' using errcode='insufficient_privilege'; end if;
  select hub into source_hub from network.consumer_session_schemas where id=p_from_schema_id;
  select hub into target_hub from network.consumer_session_schemas where id=p_to_schema_id;
  if source_hub is null or target_hub is null or source_hub<>target_hub then raise exception 'SESSION_MIGRATION_HUB_MISMATCH' using errcode='22023'; end if;
  insert into network.consumer_session_schema_migrations(from_schema_id,to_schema_id,hub,adapter_key,status)
  values(p_from_schema_id,p_to_schema_id,source_hub,p_adapter_key,p_status)
  on conflict(from_schema_id,to_schema_id) do update set adapter_key=excluded.adapter_key,status=excluded.status
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function network.propose_consumer_session_schema(text,integer,text,text,integer,text[],text[],text[],text,text,text,text,text) from public;
revoke all on function network.set_consumer_session_schema_status(text,integer,text) from public;
revoke all on function network.register_consumer_session_schema_migration(uuid,uuid,text,text) from public;

create or replace function consumer.save_session(
  p_hub text,p_session_type text,p_schema_key text,p_schema_version integer,
  p_payload jsonb,p_summary jsonb,p_project_id uuid,p_idempotency_key uuid,
  p_guest_origin_key text default null
)
returns table(saved_session_id uuid,created boolean,session_status text,row_version bigint,resume_ref uuid)
language plpgsql security definer set search_path=pg_catalog,consumer,network,extensions as $$
declare subject uuid:=consumer.require_user(); existing consumer.consumer_saved_sessions%rowtype; new_id uuid; fp text; prior_fp text;
begin
  perform consumer.assert_session_actor(p_hub,'session:write');
  if p_idempotency_key is null then raise exception 'idempotency key required' using errcode='not_null_violation'; end if;
  perform consumer.validate_saved_session_content(p_hub,p_session_type,p_schema_key,p_schema_version,p_payload,p_summary,true);
  if p_project_id is not null and not exists(select 1 from consumer.consumer_projects p where p.id=p_project_id and p.user_id=subject) then
    raise exception 'PROJECT_MEMBERSHIP_CONFLICT' using errcode='insufficient_privilege';
  end if;
  fp:=encode(digest(jsonb_build_object('hub',p_hub,'type',p_session_type,'schema',p_schema_key,'version',p_schema_version,'payload',p_payload,'summary',p_summary,'project',p_project_id,'guest',p_guest_origin_key)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(subject::text||':'||p_idempotency_key::text,0));
  select * into existing from consumer.consumer_saved_sessions s where s.user_id=subject and s.create_idempotency_key=p_idempotency_key;
  if existing.id is not null then
    select request_fingerprint into prior_fp from consumer.consumer_session_events e
    where e.user_id=subject and e.idempotency_key=p_idempotency_key;
    if prior_fp is distinct from fp then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='unique_violation';
    end if;
    return query select existing.id,false,existing.status,existing.row_version,existing.resume_ref; return;
  end if;
  if p_guest_origin_key is not null then
    select * into existing from consumer.consumer_saved_sessions s
    where s.user_id=subject and s.hub=p_hub and s.guest_origin_key=p_guest_origin_key;
    if existing.id is not null then
      if existing.payload_fingerprint<>encode(digest(p_payload::text,'sha256'),'hex')
        or existing.schema_key<>p_schema_key or existing.schema_version<>p_schema_version then
        raise exception 'GUEST_SESSION_KEY_REUSED' using errcode='unique_violation';
      end if;
      if p_project_id is not null then perform consumer.add_saved_session_to_project(p_project_id,existing.id,null); end if;
      return query select existing.id,false,existing.status,existing.row_version,existing.resume_ref; return;
    end if;
  end if;
  insert into consumer.consumer_saved_sessions(
    user_id,hub,session_type,schema_key,schema_version,payload,payload_fingerprint,summary,
    create_idempotency_key,guest_origin_key
  ) values(subject,p_hub,p_session_type,p_schema_key,p_schema_version,p_payload,
    encode(digest(p_payload::text,'sha256'),'hex'),p_summary,p_idempotency_key,p_guest_origin_key)
  returning id into new_id;
  insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,request_fingerprint,resulting_row_version)
  values(subject,new_id,'saved',p_idempotency_key,fp,1);
  if p_project_id is not null then perform consumer.add_saved_session_to_project(p_project_id,new_id,null); end if;
  return query select s.id,true,s.status,s.row_version,s.resume_ref from consumer.consumer_saved_sessions s where s.id=new_id;
end;
$$;

revoke all on function consumer.save_session(text,text,text,integer,jsonb,jsonb,uuid,uuid,text) from public;

create or replace function consumer.update_saved_session(
  p_saved_session_id uuid,p_schema_key text,p_schema_version integer,p_payload jsonb,p_summary jsonb,
  p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer,extensions as $$
declare subject uuid:=consumer.require_user(); current_row consumer.consumer_saved_sessions%rowtype; existing_event consumer.consumer_session_events%rowtype; fp text; new_version bigint;
begin
  select * into current_row from consumer.consumer_saved_sessions s where s.id=p_saved_session_id and s.user_id=subject for update;
  if current_row.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  perform consumer.assert_session_actor(current_row.hub,'session:write');
  if current_row.status<>'active' then raise exception 'SESSION_NOT_EDITABLE' using errcode='object_not_in_prerequisite_state'; end if;
  if p_schema_key<>current_row.schema_key or p_schema_version<>current_row.schema_version then
    raise exception 'SESSION_MIGRATION_ADAPTER_REQUIRED' using errcode='object_not_in_prerequisite_state';
  end if;
  perform consumer.validate_saved_session_content(current_row.hub,current_row.session_type,p_schema_key,p_schema_version,p_payload,p_summary,true);
  fp:=encode(digest(jsonb_build_object('session',p_saved_session_id,'schema',p_schema_key,'version',p_schema_version,'payload',p_payload,'summary',p_summary)::text,'sha256'),'hex');
  select * into existing_event from consumer.consumer_session_events e where e.user_id=subject and e.idempotency_key=p_idempotency_key;
  if existing_event.id is not null then
    if existing_event.request_fingerprint<>fp then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='unique_violation'; end if;
    return existing_event.resulting_row_version;
  end if;
  if current_row.row_version<>p_expected_row_version then raise exception 'SESSION_STALE' using errcode='serialization_failure'; end if;
  update consumer.consumer_saved_sessions set schema_key=p_schema_key,schema_version=p_schema_version,
    payload=p_payload,payload_fingerprint=encode(digest(p_payload::text,'sha256'),'hex'),summary=p_summary,
    row_version=row_version+1 where id=p_saved_session_id returning row_version into new_version;
  insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,request_fingerprint,resulting_row_version)
  values(subject,p_saved_session_id,'updated',p_idempotency_key,fp,new_version);
  return new_version;
end;
$$;

create or replace function consumer.add_saved_session_to_project(
  p_project_id uuid,p_saved_session_id uuid,p_idempotency_key uuid default null
)
returns boolean
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); session_hub text; changed boolean:=false;
begin
  select hub into session_hub from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject;
  if session_hub is null or not exists(select 1 from consumer.consumer_projects where id=p_project_id and user_id=subject) then
    raise exception 'PROJECT_MEMBERSHIP_CONFLICT' using errcode='insufficient_privilege';
  end if;
  perform consumer.assert_session_actor(session_hub,'session:write');
  insert into consumer.consumer_project_saved_sessions(project_id,saved_session_id)
  values(p_project_id,p_saved_session_id)
  on conflict(project_id,saved_session_id) do update set
    removed_at=null,added_at=case when consumer.consumer_project_saved_sessions.removed_at is null then consumer.consumer_project_saved_sessions.added_at else statement_timestamp() end,
    row_version=consumer.consumer_project_saved_sessions.row_version+1
  where consumer.consumer_project_saved_sessions.removed_at is not null
  returning true into changed;
  if p_idempotency_key is not null and not exists(select 1 from consumer.consumer_session_events where user_id=subject and idempotency_key=p_idempotency_key) then
    insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,resulting_row_version)
    values(subject,p_saved_session_id,'project_added',p_idempotency_key,(select row_version from consumer.consumer_saved_sessions where id=p_saved_session_id));
  end if;
  return coalesce(changed,true);
end;
$$;

create or replace function consumer.remove_saved_session_from_project(
  p_project_id uuid,p_saved_session_id uuid,p_idempotency_key uuid default null
)
returns boolean
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); session_hub text; affected integer;
begin
  select hub into session_hub from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject;
  if session_hub is null or not exists(select 1 from consumer.consumer_projects where id=p_project_id and user_id=subject) then
    raise exception 'PROJECT_MEMBERSHIP_CONFLICT' using errcode='insufficient_privilege';
  end if;
  perform consumer.assert_session_actor(session_hub,'session:write');
  update consumer.consumer_project_saved_sessions set removed_at=statement_timestamp(),row_version=row_version+1
  where project_id=p_project_id and saved_session_id=p_saved_session_id and removed_at is null;
  get diagnostics affected=row_count;
  if p_idempotency_key is not null and affected=1 then
    insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,resulting_row_version)
    values(subject,p_saved_session_id,'project_removed',p_idempotency_key,(select row_version from consumer.consumer_saved_sessions where id=p_saved_session_id))
    on conflict(user_id,idempotency_key) do nothing;
  end if;
  return affected=1;
end;
$$;

create or replace function consumer.archive_saved_session(p_saved_session_id uuid,p_expected_row_version bigint,p_idempotency_key uuid)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_saved_sessions%rowtype; prior consumer.consumer_session_events%rowtype; new_version bigint;
begin
  select * into s from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject for update;
  if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  perform consumer.assert_session_actor(s.hub,'session:write');
  select * into prior from consumer.consumer_session_events where user_id=subject and idempotency_key=p_idempotency_key;
  if prior.id is not null then return prior.resulting_row_version; end if;
  if s.row_version<>p_expected_row_version then raise exception 'SESSION_STALE' using errcode='serialization_failure'; end if;
  if s.status='read_only' then raise exception 'SESSION_READ_ONLY' using errcode='object_not_in_prerequisite_state'; end if;
  if s.status<>'active' then raise exception 'SESSION_NOT_ACTIVE' using errcode='object_not_in_prerequisite_state'; end if;
  update consumer.consumer_saved_sessions set status='archived',archived_at=statement_timestamp(),row_version=row_version+1
  where id=s.id returning row_version into new_version;
  insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,resulting_row_version)
  values(subject,s.id,'archived',p_idempotency_key,new_version);
  return new_version;
end;
$$;

create or replace function consumer.restore_saved_session(p_saved_session_id uuid,p_expected_row_version bigint,p_idempotency_key uuid)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_saved_sessions%rowtype; schema_status text; prior consumer.consumer_session_events%rowtype; new_version bigint;
begin
  select * into s from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject for update;
  if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  perform consumer.assert_session_actor(s.hub,'session:write');
  select * into prior from consumer.consumer_session_events where user_id=subject and idempotency_key=p_idempotency_key;
  if prior.id is not null then return prior.resulting_row_version; end if;
  if s.row_version<>p_expected_row_version then raise exception 'SESSION_STALE' using errcode='serialization_failure'; end if;
  if s.status<>'archived' then raise exception 'SESSION_NOT_ARCHIVED' using errcode='object_not_in_prerequisite_state'; end if;
  select status into schema_status from network.consumer_session_schemas where schema_key=s.schema_key and version=s.schema_version;
  if schema_status not in ('approved','deprecated') then raise exception 'SESSION_SCHEMA_NOT_RESUMABLE' using errcode='object_not_in_prerequisite_state'; end if;
  update consumer.consumer_saved_sessions set status='active',archived_at=null,row_version=row_version+1
  where id=s.id returning row_version into new_version;
  insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,resulting_row_version)
  values(subject,s.id,'restored',p_idempotency_key,new_version);
  return new_version;
end;
$$;

create or replace function consumer.remove_saved_session(p_saved_session_id uuid,p_expected_row_version bigint,p_idempotency_key uuid)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_saved_sessions%rowtype;
begin
  select * into s from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject;
  if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  if exists(select 1 from consumer.consumer_project_saved_sessions m where m.saved_session_id=s.id and m.removed_at is null) then
    raise exception 'SESSION_PROJECT_MEMBERSHIP_CONFLICT' using errcode='integrity_constraint_violation';
  end if;
  return consumer.archive_saved_session(p_saved_session_id,p_expected_row_version,p_idempotency_key);
end;
$$;

create or replace function consumer.mark_saved_session_resumed(p_saved_session_id uuid,p_expected_row_version bigint,p_idempotency_key uuid)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_saved_sessions%rowtype; schema_status text; prior consumer.consumer_session_events%rowtype; new_version bigint;
begin
  select * into s from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject for update;
  if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  perform consumer.assert_session_actor(s.hub,'session:read');
  select * into prior from consumer.consumer_session_events where user_id=subject and idempotency_key=p_idempotency_key;
  if prior.id is not null then return prior.resulting_row_version; end if;
  if s.row_version<>p_expected_row_version then raise exception 'SESSION_STALE' using errcode='serialization_failure'; end if;
  select status into schema_status from network.consumer_session_schemas where schema_key=s.schema_key and version=s.schema_version;
  if s.status<>'active' or schema_status not in ('approved','deprecated') then raise exception 'SESSION_NOT_RESUMABLE' using errcode='object_not_in_prerequisite_state'; end if;
  update consumer.consumer_saved_sessions set last_resumed_at=statement_timestamp(),row_version=row_version+1
  where id=s.id returning row_version into new_version;
  insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,resulting_row_version)
  values(subject,s.id,'resumed',p_idempotency_key,new_version);
  return new_version;
end;
$$;

create or replace function consumer.apply_saved_session_schema_migration(
  p_saved_session_id uuid,p_to_schema_key text,p_to_schema_version integer,p_migrated_payload jsonb,p_migrated_summary jsonb,
  p_expected_row_version bigint,p_idempotency_key uuid
)
returns bigint
language plpgsql security definer set search_path=pg_catalog,consumer,network,extensions as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_saved_sessions%rowtype; from_id uuid; to_id uuid; prior consumer.consumer_session_events%rowtype; new_version bigint;
begin
  select * into s from consumer.consumer_saved_sessions where id=p_saved_session_id and user_id=subject for update;
  if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  perform consumer.assert_session_actor(s.hub,'session:write');
  select id into from_id from network.consumer_session_schemas where schema_key=s.schema_key and version=s.schema_version;
  select consumer.validate_saved_session_content(s.hub,s.session_type,p_to_schema_key,p_to_schema_version,p_migrated_payload,p_migrated_summary,true) into to_id;
  if not exists(select 1 from network.consumer_session_schema_migrations m where m.from_schema_id=from_id and m.to_schema_id=to_id and m.status='approved') then
    raise exception 'SESSION_MIGRATION_ADAPTER_REQUIRED' using errcode='object_not_in_prerequisite_state';
  end if;
  select * into prior from consumer.consumer_session_events where user_id=subject and idempotency_key=p_idempotency_key;
  if prior.id is not null then return prior.resulting_row_version; end if;
  if s.row_version<>p_expected_row_version then raise exception 'SESSION_STALE' using errcode='serialization_failure'; end if;
  update consumer.consumer_saved_sessions set schema_key=p_to_schema_key,schema_version=p_to_schema_version,
    payload=p_migrated_payload,payload_fingerprint=encode(digest(p_migrated_payload::text,'sha256'),'hex'),summary=p_migrated_summary,
    status='active',archived_at=null,row_version=row_version+1 where id=s.id returning row_version into new_version;
  insert into consumer.consumer_session_events(user_id,saved_session_id,event_type,idempotency_key,resulting_row_version)
  values(subject,s.id,'schema_migrated',p_idempotency_key,new_version);
  return new_version;
end;
$$;

create or replace function consumer.get_saved_session_for_resume(p_resume_ref uuid)
returns table(
  saved_session_id uuid,hub text,session_type text,schema_key text,schema_version integer,
  payload jsonb,summary jsonb,resume_kind text,resume_route_key text,row_version bigint
)
language plpgsql stable security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user(); s consumer.consumer_saved_sessions%rowtype;
begin
  select * into s from consumer.consumer_saved_sessions x where x.resume_ref=p_resume_ref and x.user_id=subject;
  if s.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='no_data_found'; end if;
  perform consumer.assert_session_actor(s.hub,'session:read');
  if s.status<>'active' then raise exception 'SESSION_NOT_RESUMABLE' using errcode='object_not_in_prerequisite_state'; end if;
  return query select s.id,s.hub,s.session_type,s.schema_key,s.schema_version,s.payload,s.summary,
    r.resume_kind,r.resume_route_key,s.row_version
  from network.consumer_session_schemas r
  where r.schema_key=s.schema_key and r.version=s.schema_version and r.status in ('approved','deprecated');
  if not found then raise exception 'SESSION_NOT_RESUMABLE' using errcode='object_not_in_prerequisite_state'; end if;
end;
$$;

create or replace function consumer.list_saved_session_summaries(p_limit integer default 50)
returns table(
  saved_session_id uuid,title text,hub text,session_type text,summary jsonb,status text,
  schema_key text,schema_version integer,schema_status text,project_memberships jsonb,
  last_activity_at timestamptz,resume_available boolean,resume_ref uuid
)
language plpgsql stable security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user();
begin
  if p_limit not between 1 and 100 then raise exception 'RATE_LIMITED' using errcode='program_limit_exceeded'; end if;
  return query
  select s.id,coalesce(s.summary->>'title',initcap(replace(s.session_type,'_',' '))),s.hub,s.session_type,s.summary,s.status,
    s.schema_key,s.schema_version,r.status,
    coalesce((select jsonb_agg(jsonb_build_object('project_ref',p.id,'name',p.name,'status',p.status) order by p.updated_at desc)
      from consumer.consumer_project_saved_sessions m join consumer.consumer_projects p on p.id=m.project_id
      where m.saved_session_id=s.id and m.removed_at is null),'[]'::jsonb),
    greatest(s.created_at,s.updated_at,coalesce(s.last_resumed_at,'-infinity'::timestamptz)),
    s.status='active' and r.status in ('approved','deprecated'),s.resume_ref
  from consumer.consumer_saved_sessions s
  join network.consumer_session_schemas r on r.schema_key=s.schema_key and r.version=s.schema_version
  where s.user_id=subject
  order by greatest(s.created_at,s.updated_at,coalesce(s.last_resumed_at,'-infinity'::timestamptz)) desc,s.id
  limit p_limit;
end;
$$;

create or replace function consumer.list_continue_sessions(p_limit integer default 10)
returns table(saved_session_id uuid,title text,hub text,session_type text,summary jsonb,last_activity_at timestamptz,resume_ref uuid)
language plpgsql stable security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user();
begin
  if p_limit not between 1 and 25 then raise exception 'RATE_LIMITED' using errcode='program_limit_exceeded'; end if;
  return query select s.id,coalesce(s.summary->>'title',initcap(s.session_type)),s.hub,s.session_type,s.summary,
    greatest(s.created_at,s.updated_at,coalesce(s.last_resumed_at,'-infinity'::timestamptz)),s.resume_ref
  from consumer.consumer_saved_sessions s join network.consumer_session_schemas r
    on r.schema_key=s.schema_key and r.version=s.schema_version
  where s.user_id=subject and s.status='active' and r.status in ('approved','deprecated')
  order by greatest(s.created_at,s.updated_at,coalesce(s.last_resumed_at,'-infinity'::timestamptz)) desc,s.id
  limit p_limit;
end;
$$;

create or replace function ops.create_session_resume_handoff(
  p_raw_code text,p_canonical_user_id uuid,p_saved_session_id uuid,p_target_hub text,
  p_return_path text,p_raw_browser_state text,p_raw_nonce text
)
returns uuid
language plpgsql security definer set search_path=pg_catalog,ops,consumer as $$
declare actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); new_id uuid; session_hub text;
begin
  if actor<>'myth_handoff_broker' then raise exception 'HANDOFF_BROKER_REQUIRED' using errcode='insufficient_privilege'; end if;
  select hub into session_hub from consumer.consumer_saved_sessions
  where id=p_saved_session_id and user_id=p_canonical_user_id and status='active';
  if session_hub is null or session_hub<>p_target_hub then raise exception 'INVALID_AUDIENCE' using errcode='insufficient_privilege'; end if;
  perform ops.normalize_return_path(p_target_hub,p_return_path);
  if char_length(p_raw_code)<32 or char_length(p_raw_browser_state)<32 or char_length(p_raw_nonce)<32 then
    raise exception 'INVALID_STATE' using errcode='22023';
  end if;
  insert into ops.consumer_session_resume_handoffs(
    code_hash,canonical_user_id,saved_session_id,target_hub,return_path,browser_state_hash,nonce_hash,expires_at
  ) values(ops.hash_handoff_secret(p_raw_code),p_canonical_user_id,p_saved_session_id,p_target_hub,
    ops.normalize_return_path(p_target_hub,p_return_path),ops.hash_handoff_secret(p_raw_browser_state),
    ops.hash_handoff_secret(p_raw_nonce),statement_timestamp()+interval '90 seconds') returning id into new_id;
  return new_id;
end;
$$;

create or replace function ops.consume_session_resume_handoff(
  p_raw_code text,p_canonical_user_id uuid,p_target_hub text,p_raw_browser_state text,p_raw_nonce text
)
returns table(ok boolean,error_code text,resume_ref uuid,return_path text)
language plpgsql security definer set search_path=pg_catalog,ops,consumer as $$
declare actor text:=coalesce(nullif(current_setting('role',true),'none'),session_user::text); h ops.consumer_session_resume_handoffs%rowtype; ref uuid; failure text;
begin
  if not exists(select 1 from ops.consumer_hub_registry r where r.hub_key=p_target_hub and r.database_role=actor and r.enabled and 'session:read'=any(r.allowed_scopes)) then
    raise exception 'INVALID_AUDIENCE' using errcode='insufficient_privilege';
  end if;
  select * into h from ops.consumer_session_resume_handoffs where code_hash=ops.hash_handoff_secret(p_raw_code) for update;
  if h.id is null then return query select false,'INVALID_STATE',null::uuid,null::text; return; end if;
  if h.status='consumed' then return query select false,'HANDOFF_ALREADY_USED',null::uuid,null::text; return; end if;
  if h.status<>'issued' or h.expires_at<=statement_timestamp() then
    update ops.consumer_session_resume_handoffs set status='expired' where id=h.id and status='issued';
    return query select false,'HANDOFF_EXPIRED',null::uuid,null::text; return;
  end if;
  if h.canonical_user_id<>p_canonical_user_id or h.target_hub<>p_target_hub or
    h.browser_state_hash<>ops.hash_handoff_secret(p_raw_browser_state) or h.nonce_hash<>ops.hash_handoff_secret(p_raw_nonce) then
    update ops.consumer_session_resume_handoffs set failed_attempts=least(failed_attempts+1,5),
      status=case when failed_attempts+1>=5 then 'revoked' else status end where id=h.id;
    return query select false,'INVALID_STATE',null::uuid,null::text; return;
  end if;
  select s.resume_ref into ref from consumer.consumer_saved_sessions s where s.id=h.saved_session_id and s.user_id=h.canonical_user_id and s.status='active';
  if ref is null then return query select false,'SESSION_NOT_RESUMABLE',null::uuid,null::text; return; end if;
  update ops.consumer_session_resume_handoffs set status='consumed',consumed_at=statement_timestamp() where id=h.id;
  return query select true,null::text,ref,h.return_path;
end;
$$;

create or replace function consumer.validate_guest_session_payload(p_payload jsonb)
returns void
language plpgsql stable security invoker set search_path=pg_catalog,consumer as $$
declare item jsonb; generated_at timestamptz; expires_at timestamptz;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>262144 then
    raise exception 'GUEST_SESSION_PAYLOAD_OVERSIZED_OR_INVALID' using errcode='program_limit_exceeded';
  end if;
  if exists(select 1 from jsonb_object_keys(p_payload) x(key) where x.key not in ('version','generated_at','expires_at','items'))
    or p_payload->>'version'<>'mytrusthub-guest-sessions/v1' then
    raise exception 'GUEST_SESSION_SCHEMA_INVALID' using errcode='check_violation';
  end if;
  begin generated_at:=(p_payload->>'generated_at')::timestamptz; expires_at:=(p_payload->>'expires_at')::timestamptz;
  exception when others then raise exception 'GUEST_SESSION_TIMESTAMPS_INVALID' using errcode='invalid_datetime_format'; end;
  if generated_at>statement_timestamp()+interval '5 minutes' or expires_at>generated_at+interval '90 days' then
    raise exception 'GUEST_SESSION_RETENTION_INVALID' using errcode='check_violation';
  end if;
  if jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items')>50 then
    raise exception 'GUEST_SESSION_ITEMS_INVALID' using errcode='check_violation';
  end if;
  if (select count(*)<>count(distinct value->>'client_item_id') from jsonb_array_elements(p_payload->'items')) then
    raise exception 'GUEST_SESSION_ITEM_IDS_NOT_UNIQUE' using errcode='unique_violation';
  end if;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
    if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) x(key) where x.key not in (
      'client_item_id','item_type','hub','session_type','schema_key','schema_version','payload','summary','created_at','guest_session_key'
    )) or item->>'item_type'<>'saved_session' or char_length(coalesce(item->>'client_item_id','')) not between 1 and 100
      or char_length(coalesce(item->>'guest_session_key','')) not between 1 and 128 then
      raise exception 'GUEST_SESSION_ITEM_INVALID' using errcode='check_violation';
    end if;
  end loop;
end;
$$;

create or replace function consumer.preview_guest_session_import(p_payload jsonb)
returns table(client_item_id text,item_status text,valid boolean,importable boolean,existing_saved_session_id uuid,project_assignment_eligible boolean)
language plpgsql stable security definer set search_path=pg_catalog,consumer,network as $$
declare subject uuid:=consumer.require_user(); item jsonb; expiry timestamptz; registry network.consumer_session_schemas%rowtype; duplicate_id uuid;
begin
  perform consumer.validate_guest_session_payload(p_payload);
  expiry:=(p_payload->>'expires_at')::timestamptz;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
    client_item_id:=item->>'client_item_id'; existing_saved_session_id:=null; project_assignment_eligible:=false;
    if expiry<=statement_timestamp() then item_status:='expired';valid:=true;importable:=false;return next;continue; end if;
    select * into registry from network.consumer_session_schemas r where r.schema_key=item->>'schema_key' and r.version=(item->>'schema_version')::integer
      and r.hub=item->>'hub' and r.session_type=item->>'session_type';
    if registry.id is null or registry.status not in ('approved') then item_status:='unsupported_version';valid:=false;importable:=false;return next;continue; end if;
    begin
      perform consumer.validate_saved_session_content(item->>'hub',item->>'session_type',item->>'schema_key',(item->>'schema_version')::integer,item->'payload',item->'summary',true);
    exception when program_limit_exceeded then item_status:='oversized';valid:=false;importable:=false;return next;continue;
      when others then item_status:='invalid';valid:=false;importable:=false;return next;continue;
    end;
    select id into duplicate_id from consumer.consumer_saved_sessions s where s.user_id=subject and s.hub=item->>'hub' and s.guest_origin_key=item->>'guest_session_key';
    if duplicate_id is not null then item_status:='duplicate';valid:=true;importable:=true;existing_saved_session_id:=duplicate_id;
    else item_status:='valid';valid:=true;importable:=true; end if;
    project_assignment_eligible:=true; return next;
  end loop;
end;
$$;

create or replace function consumer.commit_guest_session_import(
  p_payload jsonb,p_selected_item_ids text[],p_project_id uuid,p_idempotency_key uuid
)
returns table(import_id uuid,submitted_count integer,imported_count integer,duplicate_count integer,rejected_count integer)
language plpgsql security definer set search_path=pg_catalog,consumer,extensions as $$
declare subject uuid:=consumer.require_user(); existing consumer.consumer_guest_session_imports%rowtype; v_item jsonb; preview record; saved record;
  request_fp text; submitted integer; imported integer:=0; duplicates integer:=0; rejected integer:=0; new_import uuid; derived_key uuid;
begin
  perform consumer.validate_guest_session_payload(p_payload);
  p_selected_item_ids:=coalesce(p_selected_item_ids,array[]::text[]);
  if (select count(*)<>count(distinct value) from unnest(p_selected_item_ids) x(value)) then
    raise exception 'GUEST_SELECTED_ITEM_IDS_NOT_UNIQUE' using errcode='unique_violation';
  end if;
  if exists(select 1 from unnest(p_selected_item_ids) x(value) where not exists(
    select 1 from jsonb_array_elements(p_payload->'items') as guest_item(value)
    where guest_item.value->>'client_item_id'=x.value
  )) then raise exception 'GUEST_SELECTED_ITEM_NOT_FOUND' using errcode='foreign_key_violation'; end if;
  if p_project_id is not null and not exists(select 1 from consumer.consumer_projects where id=p_project_id and user_id=subject) then raise exception 'PROJECT_MEMBERSHIP_CONFLICT' using errcode='insufficient_privilege'; end if;
  submitted:=jsonb_array_length(p_payload->'items');
  request_fp:=encode(digest(jsonb_build_object('payload',p_payload,'selected',coalesce(to_jsonb(p_selected_item_ids),'[]'::jsonb),'project',p_project_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(subject::text||':'||p_idempotency_key::text,0));
  select * into existing from consumer.consumer_guest_session_imports where user_id=subject and idempotency_key=p_idempotency_key;
  if existing.id is not null then
    if existing.request_fingerprint<>request_fp then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='unique_violation'; end if;
    return query select existing.id,existing.submitted_item_count,existing.imported_item_count,existing.duplicate_item_count,existing.rejected_item_count; return;
  end if;
  insert into consumer.consumer_guest_session_imports(user_id,import_version,idempotency_key,request_fingerprint,submitted_item_count)
  values(subject,'mytrusthub-guest-sessions/v1',p_idempotency_key,request_fp,submitted) returning id into new_import;
  for v_item in select guest_item.value from jsonb_array_elements(p_payload->'items') as guest_item(value) loop
    select * into preview from consumer.preview_guest_session_import(jsonb_build_object('version',p_payload->>'version','generated_at',p_payload->>'generated_at','expires_at',p_payload->>'expires_at','items',jsonb_build_array(v_item)));
    if not((v_item->>'client_item_id')=any(coalesce(p_selected_item_ids,array[]::text[]))) then
      insert into consumer.consumer_guest_session_import_items(import_id,client_item_id,selected,result_status,preview_status)
      values(new_import,v_item->>'client_item_id',false,'not_selected',preview.item_status); continue;
    end if;
    if not preview.importable then
      rejected:=rejected+1;
      insert into consumer.consumer_guest_session_import_items(import_id,client_item_id,selected,result_status,preview_status)
      values(new_import,v_item->>'client_item_id',true,'rejected',preview.item_status); continue;
    end if;
    derived_key:=(md5(subject::text||':'||(v_item->>'hub')||':'||(v_item->>'guest_session_key')))::uuid;
    select * into saved from consumer.save_session(v_item->>'hub',v_item->>'session_type',v_item->>'schema_key',(v_item->>'schema_version')::integer,
      v_item->'payload',v_item->'summary',p_project_id,derived_key,v_item->>'guest_session_key');
    if preview.item_status='duplicate' or not saved.created then duplicates:=duplicates+1; else imported:=imported+1; end if;
    insert into consumer.consumer_guest_session_import_items(import_id,client_item_id,selected,result_status,preview_status,saved_session_id,project_id)
    values(new_import,v_item->>'client_item_id',true,case when preview.item_status='duplicate' or not saved.created then 'duplicate' else 'imported' end,
      preview.item_status,saved.saved_session_id,p_project_id);
  end loop;
  update consumer.consumer_guest_session_imports set imported_item_count=imported,duplicate_item_count=duplicates,rejected_item_count=rejected,status='completed',completed_at=statement_timestamp() where id=new_import;
  return query select new_import,submitted,imported,duplicates,rejected;
end;
$$;

-- Consumer-private tables use ownership RLS; raw payload mutation remains function-only.
alter table network.consumer_session_schemas enable row level security;
alter table network.consumer_session_schemas force row level security;
alter table network.consumer_session_schema_migrations enable row level security;
alter table network.consumer_session_schema_migrations force row level security;
alter table consumer.consumer_saved_sessions enable row level security;
alter table consumer.consumer_saved_sessions force row level security;
alter table consumer.consumer_project_saved_sessions enable row level security;
alter table consumer.consumer_project_saved_sessions force row level security;
alter table consumer.consumer_session_events enable row level security;
alter table consumer.consumer_session_events force row level security;
alter table ops.consumer_session_resume_handoffs enable row level security;
alter table ops.consumer_session_resume_handoffs force row level security;
alter table consumer.consumer_guest_session_imports enable row level security;
alter table consumer.consumer_guest_session_imports force row level security;
alter table consumer.consumer_guest_session_import_items enable row level security;
alter table consumer.consumer_guest_session_import_items force row level security;

create policy consumer_session_schemas_governor_read on network.consumer_session_schemas
  for select to myth_session_governor using(true);
create policy consumer_session_schema_migrations_governor_read on network.consumer_session_schema_migrations
  for select to myth_session_governor using(true);
create policy consumer_saved_sessions_select_own on consumer.consumer_saved_sessions for select to authenticated
  using((select auth.uid())=user_id);
create policy consumer_project_saved_sessions_select_own on consumer.consumer_project_saved_sessions for select to authenticated
  using(exists(select 1 from consumer.consumer_saved_sessions s where s.id=saved_session_id and s.user_id=(select auth.uid())));
create policy consumer_session_events_select_own on consumer.consumer_session_events for select to authenticated
  using((select auth.uid())=user_id);
create policy consumer_guest_session_imports_select_own on consumer.consumer_guest_session_imports for select to authenticated
  using((select auth.uid())=user_id);
create policy consumer_guest_session_import_items_select_own on consumer.consumer_guest_session_import_items for select to authenticated
  using(exists(select 1 from consumer.consumer_guest_session_imports i where i.id=import_id and i.user_id=(select auth.uid())));

update ops.consumer_hub_registry set allowed_scopes=array_append(allowed_scopes,'session:read')
where not('session:read'=any(allowed_scopes));
update ops.consumer_hub_registry set allowed_scopes=array_append(allowed_scopes,'session:write')
where not('session:write'=any(allowed_scopes));

grant usage on schema network to myth_session_governor,myth_bff_move,myth_bff_lender,
  myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant select on network.consumer_session_schemas,network.consumer_session_schema_migrations to myth_session_governor;
grant execute on function network.set_consumer_session_schema_status(text,integer,text),
  network.register_consumer_session_schema_migration(uuid,uuid,text,text) to myth_session_governor;

grant execute on function network.propose_consumer_session_schema(text,integer,text,text,integer,text[],text[],text[],text,text,text,text,text)
to myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

grant select(id,user_id,hub,session_type,schema_key,schema_version,summary,resume_ref,status,created_at,updated_at,last_resumed_at,archived_at,row_version,copied_from_session_id)
on consumer.consumer_saved_sessions to authenticated;
grant select on consumer.consumer_project_saved_sessions,consumer.consumer_session_events,
  consumer.consumer_guest_session_imports,consumer.consumer_guest_session_import_items to authenticated;

grant execute on function consumer.save_session(text,text,text,integer,jsonb,jsonb,uuid,uuid,text),
  consumer.update_saved_session(uuid,text,integer,jsonb,jsonb,bigint,uuid),
  consumer.add_saved_session_to_project(uuid,uuid,uuid),
  consumer.remove_saved_session_from_project(uuid,uuid,uuid),
  consumer.archive_saved_session(uuid,bigint,uuid),consumer.restore_saved_session(uuid,bigint,uuid),
  consumer.remove_saved_session(uuid,bigint,uuid),consumer.mark_saved_session_resumed(uuid,bigint,uuid),
  consumer.apply_saved_session_schema_migration(uuid,text,integer,jsonb,jsonb,bigint,uuid),
  consumer.get_saved_session_for_resume(uuid),consumer.list_saved_session_summaries(integer),
  consumer.list_continue_sessions(integer),consumer.preview_guest_session_import(jsonb),
  consumer.commit_guest_session_import(jsonb,text[],uuid,uuid)
to authenticated,myth_consumer_api;

grant usage on schema consumer to myth_bff_ask,myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant execute on function consumer.save_session(text,text,text,integer,jsonb,jsonb,uuid,uuid,text),
  consumer.update_saved_session(uuid,text,integer,jsonb,jsonb,bigint,uuid),
  consumer.add_saved_session_to_project(uuid,uuid,uuid),consumer.remove_saved_session_from_project(uuid,uuid,uuid),
  consumer.mark_saved_session_resumed(uuid,bigint,uuid),consumer.apply_saved_session_schema_migration(uuid,text,integer,jsonb,jsonb,bigint,uuid),
  consumer.get_saved_session_for_resume(uuid)
to myth_bff_ask,myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

grant usage on schema ops to myth_handoff_broker,myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;
grant execute on function ops.create_session_resume_handoff(text,uuid,uuid,text,text,text,text) to myth_handoff_broker;
grant execute on function ops.consume_session_resume_handoff(text,uuid,text,text,text)
to myth_bff_move,myth_bff_lender,myth_bff_insurance,myth_bff_contractor,myth_bff_senior,myth_bff_investor;

revoke all on function consumer.update_saved_session(uuid,text,integer,jsonb,jsonb,bigint,uuid) from public;
revoke all on function consumer.add_saved_session_to_project(uuid,uuid,uuid) from public;
revoke all on function consumer.remove_saved_session_from_project(uuid,uuid,uuid) from public;
revoke all on function consumer.archive_saved_session(uuid,bigint,uuid) from public;
revoke all on function consumer.restore_saved_session(uuid,bigint,uuid) from public;
revoke all on function consumer.remove_saved_session(uuid,bigint,uuid) from public;
revoke all on function consumer.mark_saved_session_resumed(uuid,bigint,uuid) from public;
revoke all on function consumer.apply_saved_session_schema_migration(uuid,text,integer,jsonb,jsonb,bigint,uuid) from public;
revoke all on function consumer.get_saved_session_for_resume(uuid) from public;
revoke all on function consumer.list_saved_session_summaries(integer) from public;
revoke all on function consumer.list_continue_sessions(integer) from public;
revoke all on function ops.create_session_resume_handoff(text,uuid,uuid,text,text,text,text) from public;
revoke all on function ops.consume_session_resume_handoff(text,uuid,text,text,text) from public;
revoke all on function consumer.validate_guest_session_payload(jsonb) from public;
revoke all on function consumer.preview_guest_session_import(jsonb) from public;
revoke all on function consumer.commit_guest_session_import(jsonb,text[],uuid,uuid) from public;

commit;
