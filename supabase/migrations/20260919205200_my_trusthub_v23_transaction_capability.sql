-- V2-3F. UNAPPLIED to hosted environments. Requires P11 -> P12 -> P13 only.
-- No login, secret, existing-login membership or broad service_role is created.
begin;
create role myth_v23_authorizer nologin noinherit nosuperuser nobypassrls;
create role myth_v23_executor nologin noinherit nosuperuser nobypassrls;
create role myth_v23_foundation nologin noinherit nosuperuser nobypassrls;
create role myth_v23_cleanup nologin noinherit nosuperuser nobypassrls;
create role myth_v23_browser_store nologin noinherit nosuperuser nobypassrls;
create schema v23_private;
revoke all on schema v23_private from public,anon,authenticated;
grant usage on schema v23_private to myth_v23_authorizer,myth_v23_executor,myth_v23_foundation,myth_v23_cleanup;
grant usage on schema v23_private to myth_v23_browser_store;
create table v23_private.browser_confirmations(
  key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
  created_at timestamptz not null default statement_timestamp()
);
alter table v23_private.browser_confirmations enable row level security;
alter table v23_private.browser_confirmations force row level security;
grant select,insert,update on v23_private.browser_confirmations to myth_v23_browser_store;
create policy browser_exact_cookie on v23_private.browser_confirmations to myth_v23_browser_store
  using(key_hash=current_setting('v23.confirmation_key',true))
  with check(key_hash=current_setting('v23.confirmation_key',true));
grant select,delete on v23_private.browser_confirmations to myth_v23_cleanup;
create policy browser_cleanup on v23_private.browser_confirmations to myth_v23_cleanup
  using(created_at<statement_timestamp()-interval '1 hour');
create index v23_browser_retention on v23_private.browser_confirmations(created_at);
grant usage on schema ops to myth_v23_executor,myth_v23_foundation,myth_v23_cleanup;
create table v23_private.transaction_authority(
  backend integer not null, transaction_id bigint not null, authority jsonb not null,
  created_at timestamptz not null default clock_timestamp(), primary key(backend,transaction_id),
  check(jsonb_typeof(authority)='object' and octet_length(authority::text)<=65536)
);
alter table v23_private.transaction_authority enable row level security;
alter table v23_private.transaction_authority force row level security;
grant insert,select,delete on v23_private.transaction_authority to myth_v23_authorizer;
grant select on v23_private.transaction_authority to myth_v23_executor,myth_v23_foundation;
create policy authorizer_current on v23_private.transaction_authority to myth_v23_authorizer
  using(backend=pg_backend_pid() and transaction_id=txid_current())
  with check(backend=pg_backend_pid() and transaction_id=txid_current());
create policy executor_current on v23_private.transaction_authority for select to myth_v23_executor,myth_v23_foundation
  using(backend=pg_backend_pid() and transaction_id=txid_current() and created_at>clock_timestamp()-interval '30 seconds');
create table v23_private.exchange_validation(backend integer,transaction_id bigint,subject uuid,
  primary key(backend,transaction_id));
alter table v23_private.exchange_validation enable row level security;
alter table v23_private.exchange_validation force row level security;
grant select,insert on v23_private.exchange_validation to myth_v23_foundation;
grant select on v23_private.exchange_validation to myth_v23_executor;
grant select,delete on v23_private.exchange_validation to myth_v23_authorizer;
create policy current_exchange on v23_private.exchange_validation to myth_v23_foundation,myth_v23_executor,myth_v23_authorizer
  using(backend=pg_backend_pid() and transaction_id=txid_current())
  with check(backend=pg_backend_pid() and transaction_id=txid_current());
-- A Project operation can use only the Save produced in this exact transaction.
create table v23_private.save_validation(backend integer,transaction_id bigint,saved_id uuid,
  primary key(backend,transaction_id));
alter table v23_private.save_validation enable row level security;
alter table v23_private.save_validation force row level security;
grant select,insert on v23_private.save_validation to myth_v23_foundation;
grant select on v23_private.save_validation to myth_v23_executor;
grant select,delete on v23_private.save_validation to myth_v23_authorizer;
create policy current_save on v23_private.save_validation to myth_v23_foundation,myth_v23_authorizer,myth_v23_executor
  using(backend=pg_backend_pid() and transaction_id=txid_current())
  with check(backend=pg_backend_pid() and transaction_id=txid_current());

create function v23_private.authority() returns jsonb language plpgsql security invoker
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
revoke all on function v23_private.authority() from public;
grant execute on function v23_private.authority() to myth_v23_executor,myth_v23_foundation;

create table if not exists ops.v23_profile_runtime_records(
  kind text not null check(kind in ('stage','continuation','grant','receipt')),
  key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
  created_at timestamptz not null default statement_timestamp(),primary key(kind,key_hash)
);
alter table ops.v23_profile_runtime_records add column hub text;
alter table ops.v23_profile_runtime_records add column browser_hash text;
alter table ops.v23_profile_runtime_records add column owner_id uuid;
-- Existing proposal records, if any, remain unreadable until separately reviewed;
-- do not infer ownership/backfill arbitrary old payloads.
create table if not exists ops.v23_profile_runtime_quota(
  bucket text primary key check(bucket ~ '^[a-f0-9]{64}$'),window_start bigint not null,
  count bigint not null check(count>0)
);
alter table ops.v23_profile_runtime_records enable row level security;
alter table ops.v23_profile_runtime_records force row level security;
alter table ops.v23_profile_runtime_quota enable row level security;
alter table ops.v23_profile_runtime_quota force row level security;
revoke all on ops.v23_profile_runtime_records,ops.v23_profile_runtime_quota from public,anon,authenticated;
grant select,insert,update on ops.v23_profile_runtime_records,ops.v23_profile_runtime_quota to myth_v23_executor;

create function v23_private.record_allowed(k text,h text,b text,o uuid,w boolean) returns boolean
language plpgsql security invoker set search_path=pg_catalog,v23_private as $$
declare c jsonb:=v23_private.authority(); op text:=c->>'operation';
begin
  if h is distinct from c->>'hub' then return false; end if;
  if k in ('grant','receipt') and o is distinct from (c->>'subject')::uuid then return false; end if;
  if k<>'receipt' and b is distinct from c->>'browser' then return false; end if;
  if w then return (k='stage' and op='prepareGuestProfileTransfer')
    or (k='continuation' and op in ('prepareProfileSaveContinuation','consumeProfileSaveContinuation'))
    or (k='grant' and op='consumeProfileSaveContinuation')
    or (k='receipt' and op='commitProfileSave'); end if;
  return (op='prepareGuestProfileTransfer' and k='stage')
    or (op='prepareProfileSaveContinuation' and k in ('stage','continuation'))
    or (op='consumeProfileSaveContinuation' and k in ('stage','continuation','grant'))
    or (op='commitProfileSave' and k in ('stage','grant','receipt'))
    or (op in ('getProfileSaveReceipt','verifyProfileSaveReceipt') and k in ('grant','receipt'));
end $$;
revoke all on function v23_private.record_allowed(text,text,text,uuid,boolean) from public;
grant execute on function v23_private.record_allowed(text,text,text,uuid,boolean) to myth_v23_executor;
create function v23_private.stamp_record() returns trigger language plpgsql security invoker
set search_path=pg_catalog,v23_private as $$
declare c jsonb:=v23_private.authority();
begin
  if tg_op='INSERT' then
    new.hub:=c->>'hub';new.browser_hash:=c->>'browser';
    new.owner_id:=case when new.kind in ('grant','receipt') then (c->>'subject')::uuid else null end;
  else
    if (new.kind,new.key_hash,new.hub,new.browser_hash,new.owner_id,new.created_at)
      is distinct from (old.kind,old.key_hash,old.hub,old.browser_hash,old.owner_id,old.created_at)
      then raise exception 'immutable binding' using errcode='42501'; end if;
  end if;
  if new.kind='receipt' and new.payload->>'owner' is distinct from c->>'subject'
    then raise exception 'receipt owner' using errcode='42501'; end if;
  if new.kind='receipt' then
    if new.key_hash is distinct from c->>'receiptKey'
      or new.payload#>'{receipt,item}' is distinct from c#>'{input,item}'
      or new.payload#>>'{receipt,requestKey}' is distinct from c#>>'{input,requestKey}'
      or new.payload#>>'{receipt,accountContextRef}' is distinct from c#>>'{input,accountContextRef}'
      or new.payload#>>'{receipt,manifestDigest}' is distinct from c#>>'{input,manifestDigest}'
      or new.payload#>>'{receipt,project,projectRef}' is distinct from c#>>'{input,projectRef}'
      then raise exception 'receipt context' using errcode='42501'; end if;
    if new.payload#>>'{receipt,parent,outcome}' in ('saved','already_saved') and not exists(
      select 1 from v23_private.save_validation v where v.backend=pg_backend_pid() and v.transaction_id=txid_current()
      and v.saved_id::text=new.payload#>>'{receipt,parent,savedRef}')
      then raise exception 'durable Save required' using errcode='42501'; end if;
  end if;
  if new.kind='grant' and new.payload->>'subject' is distinct from c->>'subject'
    then raise exception 'grant owner' using errcode='42501'; end if;
  if new.kind='grant' and not exists(select 1 from v23_private.exchange_validation
    where backend=pg_backend_pid() and transaction_id=txid_current() and subject=(c->>'subject')::uuid)
    then raise exception 'P13 required before grant' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function v23_private.stamp_record() from public;
grant execute on function v23_private.stamp_record() to myth_v23_executor;
create trigger v23_stamp before insert or update on ops.v23_profile_runtime_records
  for each row execute function v23_private.stamp_record();
create policy v23_read on ops.v23_profile_runtime_records for select to myth_v23_executor
  using(v23_private.record_allowed(kind,hub,browser_hash,owner_id,false)
    and (kind<>'receipt' or key_hash=v23_private.authority()->>'receiptKey'));
create policy v23_insert on ops.v23_profile_runtime_records for insert to myth_v23_executor
  with check(v23_private.record_allowed(kind,hub,browser_hash,owner_id,true));
create policy v23_update on ops.v23_profile_runtime_records for update to myth_v23_executor
  using(v23_private.record_allowed(kind,hub,browser_hash,owner_id,true))
  with check(v23_private.record_allowed(kind,hub,browser_hash,owner_id,true));
create policy v23_quota on ops.v23_profile_runtime_quota to myth_v23_executor
  using(bucket=v23_private.authority()->>'quotaKey') with check(bucket=v23_private.authority()->>'quotaKey');

-- Wrappers owned by a non-login, non-owner, non-BYPASSRLS role. Runtime cannot
-- invoke original P12/P13 routines or manufacture a different auth.uid().
grant usage on schema consumer,network,auth to myth_v23_foundation;
grant select on network.network_entities,network.network_entity_bindings to myth_v23_foundation;
grant select on network.network_entity_redirects to myth_v23_foundation;
create policy v23_redirect_resolution on network.network_entity_redirects for select to myth_v23_foundation using(true);
grant usage on schema extensions to myth_v23_foundation;
grant execute on function extensions.digest(text,text) to myth_v23_foundation;
grant select on ops.v23_profile_runtime_records to myth_v23_foundation;
create policy v23_foundation_context on ops.v23_profile_runtime_records for select to myth_v23_foundation
  using(hub=v23_private.authority()->>'hub' and browser_hash=v23_private.authority()->>'browser'
    and ((kind='grant' and owner_id=(v23_private.authority()->>'subject')::uuid
      and key_hash=encode(extensions.digest(v23_private.authority()#>>'{input,accountContextRef}','sha256'),'hex'))
      or (kind='stage' and key_hash=encode(extensions.digest(v23_private.authority()#>>'{input,transferRef}','sha256'),'hex'))));
create policy v23_binding_read on network.network_entity_bindings for select to myth_v23_foundation
  using(hub=v23_private.authority()->>'hub'
    and specialist_entity_id=v23_private.authority()#>>'{input,item,profile,nativeId}'
    and specialist_entity_type=v23_private.authority()#>>'{input,item,profile,profileClass}');
create policy v23_entity_read on network.network_entities for select to myth_v23_foundation
  using(exists(select 1 from network.network_entity_bindings b where network.resolve_canonical_entity(b.network_entity_id)=network_entities.id));
grant execute on function network.resolve_canonical_entity(uuid) to myth_v23_foundation;
grant execute on function consumer.save_entity(uuid,text,jsonb),consumer.add_saved_entity_to_project(uuid,uuid,text),
  ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text) to myth_v23_foundation;
create function v23_private.save_profile(binding_id uuid) returns table(saved_entity_id uuid,created boolean,restored boolean)
language plpgsql security definer set search_path=pg_catalog,v23_private,network,consumer as $$
declare c jsonb:=v23_private.authority(); r record;
begin
  if c->>'operation'<>'commitProfileSave' or not exists(select 1 from network.network_entity_bindings b
    join network.network_entities e on e.id=network.resolve_canonical_entity(b.network_entity_id)
    where b.id=binding_id and b.hub=c->>'hub' and b.specialist_entity_id=c#>>'{input,item,profile,nativeId}'
    and b.specialist_entity_type=c#>>'{input,item,profile,profileClass}' and b.binding_status='accepted'
    and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()) and e.status='active')
    then raise exception 'binding scope' using errcode='42501'; end if;
  if not exists(select 1 from ops.v23_profile_runtime_records g,ops.v23_profile_runtime_records s
    where g.kind='grant' and s.kind='stage' and g.payload->>'stageKey'=s.key_hash
    and g.payload->>'session'=c->>'session' and g.payload->>'browser'=c->>'browser'
    and (g.payload->>'expiresAt')::numeric>extract(epoch from statement_timestamp())*1000
    and (s.payload->>'expiresAt')::numeric>extract(epoch from statement_timestamp())*1000
    and s.payload->>'digest'=c#>>'{input,manifestDigest}'
    and s.payload#>'{input,selected}' @> jsonb_build_array(c#>'{input,item}'))
    then raise exception 'P13 context/manifest required' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',c->>'subject',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c->>'subject')::text,true);
  select * into r from consumer.save_entity(binding_id,c->>'hub','{"purpose":"v2_3_profile_save"}'::jsonb);
  insert into v23_private.save_validation values(pg_backend_pid(),txid_current(),r.saved_entity_id);
  return query select r.saved_entity_id,r.created,r.restored;
end $$;
alter function v23_private.save_profile(uuid) owner to myth_v23_foundation;
revoke all on function v23_private.save_profile(uuid) from public;
grant execute on function v23_private.save_profile(uuid) to myth_v23_executor;
create function v23_private.add_project(project_id uuid,saved_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,v23_private,consumer as $$
declare c jsonb:=v23_private.authority();
begin
  if c->>'operation'<>'commitProfileSave' or project_id::text is distinct from c->>'projectId'
    or not exists(select 1 from v23_private.save_validation v where v.backend=pg_backend_pid()
      and v.transaction_id=txid_current() and v.saved_id=add_project.saved_id)
    then raise exception 'project scope' using errcode='42501'; end if;
  perform set_config('request.jwt.claim.sub',c->>'subject',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c->>'subject')::text,true);
  return consumer.add_saved_entity_to_project(project_id,saved_id,null);
end $$;
alter function v23_private.add_project(uuid,uuid) owner to myth_v23_foundation;
revoke all on function v23_private.add_project(uuid,uuid) from public;
grant execute on function v23_private.add_project(uuid,uuid) to myth_v23_executor;
create function v23_private.consume_context(proof jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,v23_private,ops as $$
declare c jsonb:=v23_private.authority(); r record;
begin
  if c->>'operation'<>'consumeProfileSaveContinuation' or proof is distinct from c->'exchangeProof'
    then raise exception 'exchange scope' using errcode='42501'; end if;
  select * into r from ops.consume_consumer_auth_handoff(proof->>'code',c->>'hub','ask',proof->>'targetOrigin',proof->>'state',proof->>'nonce',proof->>'rateBucket');
  if not r.ok or r.canonical_user_id::text is distinct from c->>'subject' then raise exception 'P13 denied' using errcode='42501'; end if;
  insert into v23_private.exchange_validation values(pg_backend_pid(),txid_current(),r.canonical_user_id);
  return r.canonical_user_id;
end $$;
alter function v23_private.consume_context(jsonb) owner to myth_v23_foundation;
revoke all on function v23_private.consume_context(jsonb) from public;
grant execute on function v23_private.consume_context(jsonb) to myth_v23_executor;

grant select,delete on ops.v23_profile_runtime_records,ops.v23_profile_runtime_quota to myth_v23_cleanup;
create policy v23_cleanup_records on ops.v23_profile_runtime_records to myth_v23_cleanup
  using(created_at<statement_timestamp()-case when kind='receipt' then interval '30 days' else interval '1 hour' end);
create policy v23_cleanup_quota on ops.v23_profile_runtime_quota to myth_v23_cleanup
  using(window_start<floor(extract(epoch from statement_timestamp())/60)-1440);
create index v23_retention on ops.v23_profile_runtime_records(created_at,kind);
create index v23_quota_retention on ops.v23_profile_runtime_quota(window_start);
-- Authorizer rows must be deleted before commit; crash/rollback leaves no grant.
-- No role memberships: a later approved isolated parent login must be scoped.
commit;
