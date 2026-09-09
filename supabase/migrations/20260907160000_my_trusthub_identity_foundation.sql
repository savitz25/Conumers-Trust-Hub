-- My TrustHub P11B: parent-owned identity/control-plane foundation.
-- Target: the dedicated Conumers-Trust-Hub control plane only.
-- This migration intentionally does not create Saves, Projects, Watches, Alerts,
-- sessions, decisions, observations, delivery jobs, export jobs, or deletion jobs.

begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists network;
create schema if not exists consumer;
create schema if not exists ops;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

comment on schema network is
  'Parent-owned cross-network identity registry. Specialist evidence remains hub-owned.';
comment on schema consumer is
  'Private My TrustHub consumer state keyed only by the canonical parent auth subject.';
comment on schema ops is
  'Private operational identity-link and later handoff/job state; never a browser API surface.';

do $$
declare
  role_name text;
begin
  foreach role_name in array array[
    'myth_identity_proposer_move',
    'myth_identity_proposer_lender',
    'myth_identity_proposer_insurance',
    'myth_identity_proposer_contractor',
    'myth_identity_proposer_senior',
    'myth_identity_proposer_investor',
    'myth_identity_governor',
    'myth_identity_linker',
    'myth_source_ingestor',
    'myth_change_detector',
    'myth_alert_fanout',
    'myth_notification_delivery',
    'myth_export_worker',
    'myth_deletion_worker'
  ]
  loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('create role %I nologin noinherit', role_name);
    end if;
  end loop;
end;
$$;

comment on role myth_identity_governor is
  'Parent identity-governance role. Accepts bindings and creates reviewed redirects.';
comment on role myth_identity_linker is
  'Parent identity-link role. Links verified legacy subjects to canonical auth.users IDs.';
comment on role myth_source_ingestor is 'Reserved least-privilege P16 role; no P11B data privileges.';
comment on role myth_change_detector is 'Reserved least-privilege P16 role; no P11B data privileges.';
comment on role myth_alert_fanout is 'Reserved least-privilege P17 role; no P11B data privileges.';
comment on role myth_notification_delivery is 'Reserved least-privilege P18 role; no P11B data privileges.';
comment on role myth_export_worker is 'Reserved least-privilege P19 role; no P11B data privileges.';
comment on role myth_deletion_worker is 'Reserved least-privilege P19 role; no P11B data privileges.';

revoke all on schema network from public, anon, authenticated;
revoke all on schema consumer from public, anon, authenticated;
revoke all on schema ops from public, anon, authenticated;

create or replace function network.request_actor()
returns text
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    session_user::text
  );
$$;

revoke all on function network.request_actor() from public;

create or replace function network.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function network.set_updated_at() from public;

create table network.network_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null
    check (entity_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  canonical_name text not null
    check (char_length(btrim(canonical_name)) between 1 and 300),
  primary_hub text not null
    check (primary_hub in ('move', 'lender', 'insurance', 'contractor', 'senior', 'investor')),
  jurisdiction text null
    check (jurisdiction is null or char_length(btrim(jurisdiction)) between 1 and 100),
  canonical_public_profile_ref text null
    check (
      canonical_public_profile_ref is null
      or (
        canonical_public_profile_ref like '/%'
        and canonical_public_profile_ref not like '//%'
        and char_length(canonical_public_profile_ref) <= 512
      )
    ),
  status text not null default 'active'
    check (status in ('active', 'review_required', 'merged', 'retired')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on table network.network_entities is
  'Thin canonical registry only. It must never contain ranking, Trust Score, or copied regulator evidence.';
comment on column network.network_entities.id is
  'Stable network entity ID. Hub-local entity IDs remain authoritative through bindings.';

create trigger network_entities_set_updated_at
before update on network.network_entities
for each row execute function network.set_updated_at();

create table network.network_entity_bindings (
  id uuid primary key default gen_random_uuid(),
  network_entity_id uuid not null
    references network.network_entities(id) on delete restrict,
  hub text not null
    check (hub in ('move', 'lender', 'insurance', 'contractor', 'senior', 'investor')),
  specialist_entity_type text not null
    check (specialist_entity_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  specialist_entity_id text not null
    check (char_length(btrim(specialist_entity_id)) between 1 and 300),
  identifier_namespace text not null
    check (identifier_namespace ~ '^[a-z0-9][a-z0-9_.:-]{1,127}$'),
  source_identifier text not null
    check (char_length(btrim(source_identifier)) between 1 and 300),
  source_identifier_normalized text generated always as (lower(btrim(source_identifier))) stored,
  jurisdiction text null
    check (jurisdiction is null or char_length(btrim(jurisdiction)) between 1 and 100),
  jurisdiction_key text generated always as (lower(coalesce(nullif(btrim(jurisdiction), ''), '*'))) stored,
  binding_status text not null default 'review_required'
    check (binding_status in ('accepted', 'review_required', 'superseded', 'invalid')),
  confidence numeric(5,4) null
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  resolution_note text null
    check (resolution_note is null or char_length(resolution_note) <= 1000),
  valid_from timestamptz not null,
  valid_to timestamptz null,
  provenance_ref text not null
    check (char_length(btrim(provenance_ref)) between 1 and 512),
  created_by text not null default network.request_actor(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (
    network_entity_id,
    hub,
    specialist_entity_type,
    specialist_entity_id,
    identifier_namespace,
    source_identifier_normalized,
    jurisdiction_key,
    valid_from
  ),
  exclude using gist (
    hub with =,
    identifier_namespace with =,
    jurisdiction_key with =,
    source_identifier_normalized with =,
    tstzrange(valid_from, coalesce(valid_to, 'infinity'::timestamptz), '[)') with &&
  ) where (binding_status = 'accepted')
);

create unique index network_entity_bindings_current_specialist_uidx
  on network.network_entity_bindings (hub, specialist_entity_type, specialist_entity_id)
  where binding_status = 'accepted' and valid_to is null;

create index network_entity_bindings_entity_idx
  on network.network_entity_bindings (network_entity_id, binding_status);

create index network_entity_bindings_source_lookup_idx
  on network.network_entity_bindings (
    hub,
    identifier_namespace,
    jurisdiction_key,
    source_identifier_normalized,
    valid_from desc
  );

comment on table network.network_entity_bindings is
  'Binds authoritative hub-local identities to network entities with explicit provenance and validity.';
comment on column network.network_entity_bindings.binding_status is
  'Only accepted, currently valid bindings may become Watch identity inputs. review_required is never Watch-eligible.';
comment on column network.network_entity_bindings.valid_from is
  'Identifier validity is time-bounded so a reused regulator identifier never hijacks the earlier entity.';

create trigger network_entity_bindings_set_updated_at
before update on network.network_entity_bindings
for each row execute function network.set_updated_at();

create table network.network_entity_redirects (
  from_entity_id uuid primary key
    references network.network_entities(id) on delete restrict,
  to_entity_id uuid not null
    references network.network_entities(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_by text not null default network.request_actor(),
  created_at timestamptz not null default statement_timestamp(),
  check (from_entity_id <> to_entity_id)
);

create index network_entity_redirects_to_entity_idx
  on network.network_entity_redirects (to_entity_id);

comment on table network.network_entity_redirects is
  'Reviewed canonical merge/supersession edges. Insert only through create_entity_redirect to prevent cycles.';

create table network.identity_governance_events (
  id bigint generated always as identity primary key,
  action text not null,
  entity_id uuid null,
  binding_id uuid null,
  redirect_from_entity_id uuid null,
  redirect_to_entity_id uuid null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp()
);

comment on table network.identity_governance_events is
  'Append-only minimal audit of canonical entity, binding, and redirect governance actions.';

create or replace function network.audit_identity_governance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, network
as $$
declare
  event_action text;
begin
  if tg_table_name = 'network_entities' then
    event_action := case when tg_op = 'INSERT' then 'entity.created' else 'entity.updated' end;
    insert into network.identity_governance_events(action, entity_id, actor, details)
    values (
      event_action,
      new.id,
      network.request_actor(),
      jsonb_build_object('status', new.status, 'primary_hub', new.primary_hub)
    );
  elsif tg_table_name = 'network_entity_bindings' then
    event_action := case
      when tg_op = 'INSERT' then 'binding.' || new.binding_status
      when old.binding_status is distinct from new.binding_status then 'binding.' || new.binding_status
      else 'binding.updated'
    end;
    insert into network.identity_governance_events(action, entity_id, binding_id, actor, details)
    values (
      event_action,
      new.network_entity_id,
      new.id,
      network.request_actor(),
      jsonb_build_object(
        'hub', new.hub,
        'identifier_namespace', new.identifier_namespace,
        'previous_status', case when tg_op = 'UPDATE' then old.binding_status else null end,
        'status', new.binding_status,
        'provenance_ref', new.provenance_ref
      )
    );
  elsif tg_table_name = 'network_entity_redirects' then
    insert into network.identity_governance_events(
      action,
      entity_id,
      redirect_from_entity_id,
      redirect_to_entity_id,
      actor,
      details
    ) values (
      'entity.redirected',
      new.to_entity_id,
      new.from_entity_id,
      new.to_entity_id,
      network.request_actor(),
      jsonb_build_object('reason', new.reason)
    );
  end if;
  return new;
end;
$$;

revoke all on function network.audit_identity_governance() from public;

create trigger network_entities_audit
after insert or update on network.network_entities
for each row execute function network.audit_identity_governance();

create trigger network_entity_bindings_audit
after insert or update on network.network_entity_bindings
for each row execute function network.audit_identity_governance();

create trigger network_entity_redirects_audit
after insert on network.network_entity_redirects
for each row execute function network.audit_identity_governance();

create or replace function network.resolve_canonical_entity(p_entity_id uuid)
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, network
as $$
declare
  current_id uuid := p_entity_id;
  next_id uuid;
  visited uuid[] := array[]::uuid[];
  depth integer := 0;
begin
  if current_id is null then
    return null;
  end if;

  loop
    if current_id = any(visited) then
      raise exception 'network entity redirect cycle detected'
        using errcode = 'integrity_constraint_violation';
    end if;
    visited := array_append(visited, current_id);

    select r.to_entity_id
      into next_id
      from network.network_entity_redirects r
     where r.from_entity_id = current_id;

    if next_id is null then
      return current_id;
    end if;

    depth := depth + 1;
    if depth > 32 then
      raise exception 'network entity redirect depth exceeded'
        using errcode = 'program_limit_exceeded';
    end if;
    current_id := next_id;
  end loop;
end;
$$;

revoke all on function network.resolve_canonical_entity(uuid) from public;

create or replace function network.binding_is_watch_eligible(
  p_binding_id uuid,
  p_at timestamptz default statement_timestamp()
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, network
as $$
  select coalesce((
    select
      b.binding_status = 'accepted'
      and b.valid_from <= p_at
      and (b.valid_to is null or b.valid_to > p_at)
      and terminal.status = 'active'
    from network.network_entity_bindings b
    join network.network_entities terminal
      on terminal.id = network.resolve_canonical_entity(b.network_entity_id)
    where b.id = p_binding_id
  ), false);
$$;

revoke all on function network.binding_is_watch_eligible(uuid, timestamptz) from public;

create or replace function network.resolve_entity_binding(
  p_hub text,
  p_specialist_entity_type text,
  p_specialist_entity_id text,
  p_at timestamptz default statement_timestamp()
)
returns table (
  binding_id uuid,
  network_entity_id uuid,
  binding_status text,
  watch_identity_eligible boolean
)
language sql
stable
security invoker
set search_path = pg_catalog, network
as $$
  select
    b.id,
    network.resolve_canonical_entity(b.network_entity_id),
    b.binding_status,
    network.binding_is_watch_eligible(b.id, p_at)
  from network.network_entity_bindings b
  where b.hub = p_hub
    and b.specialist_entity_type = p_specialist_entity_type
    and b.specialist_entity_id = p_specialist_entity_id
    and b.valid_from <= p_at
    and (b.valid_to is null or b.valid_to > p_at)
  order by
    case b.binding_status
      when 'accepted' then 1
      when 'review_required' then 2
      when 'superseded' then 3
      else 4
    end,
    b.created_at desc
  limit 1;
$$;

revoke all on function network.resolve_entity_binding(text, text, text, timestamptz) from public;

create or replace function network.create_entity_redirect(
  p_from_entity_id uuid,
  p_to_entity_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, network
as $$
declare
  terminal_target uuid;
begin
  if p_from_entity_id is null or p_to_entity_id is null or p_from_entity_id = p_to_entity_id then
    raise exception 'redirect source and target must be distinct non-null entities'
      using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'redirect reason is required' using errcode = 'not_null_violation';
  end if;
  if not exists (select 1 from network.network_entities where id = p_from_entity_id) then
    raise exception 'redirect source entity does not exist' using errcode = 'foreign_key_violation';
  end if;
  if not exists (select 1 from network.network_entities where id = p_to_entity_id) then
    raise exception 'redirect target entity does not exist' using errcode = 'foreign_key_violation';
  end if;

  terminal_target := network.resolve_canonical_entity(p_to_entity_id);
  if terminal_target = p_from_entity_id then
    raise exception 'redirect would create a cycle' using errcode = 'integrity_constraint_violation';
  end if;

  insert into network.network_entity_redirects(from_entity_id, to_entity_id, reason)
  values (p_from_entity_id, terminal_target, p_reason);

  update network.network_entities
     set status = 'merged'
   where id = p_from_entity_id;

  return terminal_target;
end;
$$;

revoke all on function network.create_entity_redirect(uuid, uuid, text) from public;

create table consumer.consumer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_zip text null
    check (preferred_zip is null or preferred_zip ~ '^[0-9]{5}(-[0-9]{4})?$'),
  research_memory_enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

comment on table consumer.consumer_profiles is
  'Private My TrustHub root keyed by the canonical parent auth subject. Business roles grant no access.';

create trigger consumer_profiles_set_updated_at
before update on consumer.consumer_profiles
for each row execute function network.set_updated_at();

create table ops.consumer_identity_links (
  id uuid primary key default gen_random_uuid(),
  canonical_user_id uuid not null references auth.users(id) on delete cascade,
  legacy_hub text not null
    check (legacy_hub in ('move', 'lender', 'insurance', 'contractor', 'senior', 'investor')),
  legacy_subject_namespace text not null
    check (legacy_subject_namespace ~ '^[a-z0-9][a-z0-9_.:-]{1,127}$'),
  legacy_subject_id text not null
    check (char_length(btrim(legacy_subject_id)) between 1 and 300),
  link_status text not null default 'linked'
    check (link_status in ('linked', 'revoked')),
  verification_method text not null
    check (verification_method in (
      'signed_handoff',
      'reauthenticated_legacy_session',
      'admin_review',
      'migration_batch'
    )),
  evidence_ref text not null
    check (char_length(btrim(evidence_ref)) between 1 and 512),
  linked_by text not null default network.request_actor(),
  linked_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (legacy_subject_namespace, legacy_subject_id),
  check (
    (link_status = 'linked' and revoked_at is null)
    or (link_status = 'revoked' and revoked_at is not null)
  )
);

create index consumer_identity_links_canonical_user_idx
  on ops.consumer_identity_links (canonical_user_id);

comment on table ops.consumer_identity_links is
  'Explicit verified mapping from a vertical legacy subject to one canonical parent auth subject. Email-only matching is prohibited.';
comment on column ops.consumer_identity_links.legacy_subject_id is
  'Opaque vertical subject identifier. It is never copied into consumer.user_id and never inferred from email.';

create trigger consumer_identity_links_set_updated_at
before update on ops.consumer_identity_links
for each row execute function network.set_updated_at();

create table ops.consumer_identity_link_events (
  id bigint generated always as identity primary key,
  link_id uuid null references ops.consumer_identity_links(id) on delete set null,
  action text not null check (action in ('linked', 'revoked')),
  actor text not null,
  evidence_ref text not null,
  occurred_at timestamptz not null default statement_timestamp()
);

create index consumer_identity_link_events_link_idx
  on ops.consumer_identity_link_events (link_id);

create or replace function ops.audit_consumer_identity_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, ops, network
as $$
begin
  if tg_op = 'INSERT' then
    insert into ops.consumer_identity_link_events(link_id, action, actor, evidence_ref)
    values (new.id, 'linked', network.request_actor(), new.evidence_ref);
  elsif old.link_status is distinct from new.link_status and new.link_status = 'revoked' then
    insert into ops.consumer_identity_link_events(link_id, action, actor, evidence_ref)
    values (new.id, 'revoked', network.request_actor(), new.evidence_ref);
  end if;
  return new;
end;
$$;

revoke all on function ops.audit_consumer_identity_link() from public;

create trigger consumer_identity_links_audit
after insert or update on ops.consumer_identity_links
for each row execute function ops.audit_consumer_identity_link();

create or replace function ops.link_legacy_consumer_identity(
  p_canonical_user_id uuid,
  p_legacy_hub text,
  p_legacy_subject_namespace text,
  p_legacy_subject_id text,
  p_verification_method text,
  p_evidence_ref text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, ops
as $$
declare
  new_id uuid;
begin
  if p_verification_method not in (
    'signed_handoff',
    'reauthenticated_legacy_session',
    'admin_review',
    'migration_batch'
  ) then
    raise exception 'unsupported identity-link verification method'
      using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_evidence_ref, '')) = '' then
    raise exception 'identity-link evidence reference is required'
      using errcode = 'not_null_violation';
  end if;
  if not exists (select 1 from auth.users where id = p_canonical_user_id) then
    raise exception 'canonical parent auth subject does not exist'
      using errcode = 'foreign_key_violation';
  end if;

  insert into ops.consumer_identity_links(
    canonical_user_id,
    legacy_hub,
    legacy_subject_namespace,
    legacy_subject_id,
    verification_method,
    evidence_ref
  ) values (
    p_canonical_user_id,
    p_legacy_hub,
    p_legacy_subject_namespace,
    p_legacy_subject_id,
    p_verification_method,
    p_evidence_ref
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function ops.link_legacy_consumer_identity(uuid, text, text, text, text, text) from public;

alter table network.network_entities enable row level security;
alter table network.network_entities force row level security;
alter table network.network_entity_bindings enable row level security;
alter table network.network_entity_bindings force row level security;
alter table network.network_entity_redirects enable row level security;
alter table network.network_entity_redirects force row level security;
alter table network.identity_governance_events enable row level security;
alter table network.identity_governance_events force row level security;
alter table consumer.consumer_profiles enable row level security;
alter table consumer.consumer_profiles force row level security;
alter table ops.consumer_identity_links enable row level security;
alter table ops.consumer_identity_links force row level security;
alter table ops.consumer_identity_link_events enable row level security;
alter table ops.consumer_identity_link_events force row level security;

create policy consumer_profiles_select_own
on consumer.consumer_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy consumer_profiles_insert_own
on consumer.consumer_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy consumer_profiles_update_own
on consumer.consumer_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy network_entities_governor_all
on network.network_entities
for all
to myth_identity_governor
using (true)
with check (true);

create policy network_entities_proposers_read
on network.network_entities
for select
to
  myth_identity_proposer_move,
  myth_identity_proposer_lender,
  myth_identity_proposer_insurance,
  myth_identity_proposer_contractor,
  myth_identity_proposer_senior,
  myth_identity_proposer_investor
using (true);

create policy network_bindings_governor_all
on network.network_entity_bindings
for all
to myth_identity_governor
using (true)
with check (true);

create policy network_bindings_move_proposal
on network.network_entity_bindings
for insert
to myth_identity_proposer_move
with check (hub = 'move' and binding_status = 'review_required');
create policy network_bindings_move_read
on network.network_entity_bindings
for select
to myth_identity_proposer_move
using (hub = 'move');

create policy network_bindings_lender_proposal
on network.network_entity_bindings
for insert
to myth_identity_proposer_lender
with check (hub = 'lender' and binding_status = 'review_required');
create policy network_bindings_lender_read
on network.network_entity_bindings
for select
to myth_identity_proposer_lender
using (hub = 'lender');

create policy network_bindings_insurance_proposal
on network.network_entity_bindings
for insert
to myth_identity_proposer_insurance
with check (hub = 'insurance' and binding_status = 'review_required');
create policy network_bindings_insurance_read
on network.network_entity_bindings
for select
to myth_identity_proposer_insurance
using (hub = 'insurance');

create policy network_bindings_contractor_proposal
on network.network_entity_bindings
for insert
to myth_identity_proposer_contractor
with check (hub = 'contractor' and binding_status = 'review_required');
create policy network_bindings_contractor_read
on network.network_entity_bindings
for select
to myth_identity_proposer_contractor
using (hub = 'contractor');

create policy network_bindings_senior_proposal
on network.network_entity_bindings
for insert
to myth_identity_proposer_senior
with check (hub = 'senior' and binding_status = 'review_required');
create policy network_bindings_senior_read
on network.network_entity_bindings
for select
to myth_identity_proposer_senior
using (hub = 'senior');

create policy network_bindings_investor_proposal
on network.network_entity_bindings
for insert
to myth_identity_proposer_investor
with check (hub = 'investor' and binding_status = 'review_required');
create policy network_bindings_investor_read
on network.network_entity_bindings
for select
to myth_identity_proposer_investor
using (hub = 'investor');

create policy network_redirects_governor_read
on network.network_entity_redirects
for select
to myth_identity_governor
using (true);

create policy network_governance_events_governor_read
on network.identity_governance_events
for select
to myth_identity_governor
using (true);

create policy consumer_identity_links_linker_read
on ops.consumer_identity_links
for select
to myth_identity_linker
using (true);

create policy consumer_identity_link_events_linker_read
on ops.consumer_identity_link_events
for select
to myth_identity_linker
using (true);

grant usage on schema consumer to authenticated;
grant select on consumer.consumer_profiles to authenticated;
grant insert (user_id, preferred_zip, research_memory_enabled)
  on consumer.consumer_profiles to authenticated;
grant update (preferred_zip, research_memory_enabled)
  on consumer.consumer_profiles to authenticated;

grant usage on schema network to
  myth_identity_governor,
  myth_identity_proposer_move,
  myth_identity_proposer_lender,
  myth_identity_proposer_insurance,
  myth_identity_proposer_contractor,
  myth_identity_proposer_senior,
  myth_identity_proposer_investor;

grant execute on function network.request_actor() to
  myth_identity_governor,
  myth_identity_linker,
  myth_identity_proposer_move,
  myth_identity_proposer_lender,
  myth_identity_proposer_insurance,
  myth_identity_proposer_contractor,
  myth_identity_proposer_senior,
  myth_identity_proposer_investor;

grant select, insert, update on network.network_entities to myth_identity_governor;
grant select, insert, update on network.network_entity_bindings to myth_identity_governor;
grant select on network.network_entity_redirects to myth_identity_governor;
grant select on network.identity_governance_events to myth_identity_governor;
grant usage, select on sequence network.identity_governance_events_id_seq to myth_identity_governor;
grant execute on function network.resolve_canonical_entity(uuid) to myth_identity_governor;
grant execute on function network.binding_is_watch_eligible(uuid, timestamptz) to myth_identity_governor;
grant execute on function network.resolve_entity_binding(text, text, text, timestamptz) to myth_identity_governor;
grant execute on function network.create_entity_redirect(uuid, uuid, text) to myth_identity_governor;

do $$
declare
  hub text;
  proposer_role text;
begin
  foreach hub in array array['move', 'lender', 'insurance', 'contractor', 'senior', 'investor']
  loop
    proposer_role := 'myth_identity_proposer_' || hub;
    execute format('grant select on network.network_entities to %I', proposer_role);
    execute format(
      'grant select, insert on network.network_entity_bindings to %I',
      proposer_role
    );
  end loop;
end;
$$;

grant usage on schema ops to myth_identity_linker;
grant select on ops.consumer_identity_links to myth_identity_linker;
grant select on ops.consumer_identity_link_events to myth_identity_linker;
grant execute on function ops.link_legacy_consumer_identity(uuid, text, text, text, text, text)
  to myth_identity_linker;

revoke all on all tables in schema network from anon, authenticated;
revoke all on all sequences in schema network from anon, authenticated;
revoke all on all functions in schema network from anon, authenticated;
revoke all on all tables in schema ops from anon, authenticated;
revoke all on all sequences in schema ops from anon, authenticated;
revoke all on all functions in schema ops from anon, authenticated;

alter default privileges in schema network revoke all on tables from public, anon, authenticated;
alter default privileges in schema network revoke all on sequences from public, anon, authenticated;
alter default privileges in schema network revoke all on functions from public, anon, authenticated;
alter default privileges in schema consumer revoke all on tables from public, anon, authenticated;
alter default privileges in schema consumer revoke all on sequences from public, anon, authenticated;
alter default privileges in schema consumer revoke all on functions from public, anon, authenticated;
alter default privileges in schema ops revoke all on tables from public, anon, authenticated;
alter default privileges in schema ops revoke all on sequences from public, anon, authenticated;
alter default privileges in schema ops revoke all on functions from public, anon, authenticated;

-- Re-grant only the browser-facing consumer profile operations after the broad revokes.
grant usage on schema consumer to authenticated;
grant select on consumer.consumer_profiles to authenticated;
grant insert (user_id, preferred_zip, research_memory_enabled)
  on consumer.consumer_profiles to authenticated;
grant update (preferred_zip, research_memory_enabled)
  on consumer.consumer_profiles to authenticated;

commit;
