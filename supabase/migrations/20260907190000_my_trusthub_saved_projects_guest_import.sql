-- My TrustHub P12: Saved entities, Projects, memberships, private notes,
-- and consent-based guest import. Apply only after the P11 identity foundation.
-- No Watch, Alert, observation, session, decision, delivery, or export objects.

begin;

set local search_path = pg_catalog, public, extensions, network, consumer, ops;

create or replace function consumer.require_user()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog, auth
as $$
declare
  subject uuid;
begin
  subject := auth.uid();
  if subject is null then
    raise exception 'authenticated consumer subject required'
      using errcode = 'insufficient_privilege';
  end if;
  return subject;
end;
$$;

revoke all on function consumer.require_user() from public;

create or replace function consumer.valid_location_context(p_context jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select
    p_context is null
    or (
      jsonb_typeof(p_context) = 'object'
      and not exists (
        select 1
        from jsonb_object_keys(p_context) as k(key)
        where k.key not in (
          'schema_version', 'zip', 'from_zip', 'to_zip', 'care_zip', 'job_zip',
          'city', 'state', 'price_band', 'care_class', 'trade'
        )
      )
      and coalesce(p_context->>'schema_version', '1') = '1'
      and (not (p_context ? 'zip') or p_context->>'zip' ~ '^[0-9]{5}(-[0-9]{4})?$')
      and (not (p_context ? 'from_zip') or p_context->>'from_zip' ~ '^[0-9]{5}(-[0-9]{4})?$')
      and (not (p_context ? 'to_zip') or p_context->>'to_zip' ~ '^[0-9]{5}(-[0-9]{4})?$')
      and (not (p_context ? 'care_zip') or p_context->>'care_zip' ~ '^[0-9]{5}(-[0-9]{4})?$')
      and (not (p_context ? 'job_zip') or p_context->>'job_zip' ~ '^[0-9]{5}(-[0-9]{4})?$')
      and (not (p_context ? 'city') or char_length(btrim(p_context->>'city')) between 1 and 100)
      and (not (p_context ? 'state') or p_context->>'state' ~ '^[A-Z]{2}$')
      and (not (p_context ? 'price_band') or char_length(btrim(p_context->>'price_band')) between 1 and 80)
      and (not (p_context ? 'care_class') or p_context->>'care_class' in ('nursing_home', 'assisted_living', 'hospice', 'home_health'))
      and (not (p_context ? 'trade') or char_length(btrim(p_context->>'trade')) between 1 and 80)
    );
$$;

revoke all on function consumer.valid_location_context(jsonb) from public;

create table consumer.consumer_saved_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  network_entity_id uuid not null references network.network_entities(id) on delete restrict,
  source_binding_id uuid null references network.network_entity_bindings(id) on delete set null,
  identity_resolution_state text not null
    check (identity_resolution_state in ('accepted', 'review_required')),
  source_hub text null
    check (source_hub is null or source_hub in ('move', 'lender', 'insurance', 'contractor', 'senior', 'investor')),
  source_context jsonb null
    check (
      source_context is null
      or (jsonb_typeof(source_context) = 'object' and octet_length(source_context::text) <= 4096)
    ),
  saved_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz null,
  row_version bigint not null default 1 check (row_version > 0),
  unique (user_id, network_entity_id)
);

create index consumer_saved_entities_user_active_idx
  on consumer.consumer_saved_entities (user_id, saved_at desc)
  where removed_at is null;
create index consumer_saved_entities_network_entity_idx
  on consumer.consumer_saved_entities (network_entity_id);
create index consumer_saved_entities_source_binding_idx
  on consumer.consumer_saved_entities (source_binding_id)
  where source_binding_id is not null;

comment on table consumer.consumer_saved_entities is
  'One durable private Save per canonical consumer and stored network entity. Save is not Watch, endorsement, or public evidence.';
comment on column consumer.consumer_saved_entities.identity_resolution_state is
  'Resolution state when Saved. review_required is allowed to preserve research but remains ineligible for future Watch until live identity acceptance.';

create trigger consumer_saved_entities_set_updated_at
before update on consumer.consumer_saved_entities
for each row execute function network.set_updated_at();

create table consumer.consumer_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creation_key uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  life_event_type text not null
    check (life_event_type in (
      'buying_home', 'moving', 'aging_parent', 'contractor',
      'protecting', 'adviser_research', 'blank'
    )),
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  location_context jsonb null check (consumer.valid_location_context(location_context)),
  target_date date null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz null,
  archived_at timestamptz null,
  row_version bigint not null default 1 check (row_version > 0),
  unique (user_id, creation_key),
  check (
    (status = 'active' and completed_at is null and archived_at is null)
    or (status = 'completed' and completed_at is not null and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create index consumer_projects_user_status_idx
  on consumer.consumer_projects (user_id, status, updated_at desc);

comment on table consumer.consumer_projects is
  'Private life-event workspaces. Categories derive from versioned templates; P12 persists no category table or ranking order.';

create trigger consumer_projects_set_updated_at
before update on consumer.consumer_projects
for each row execute function network.set_updated_at();

create table consumer.consumer_project_saved_entities (
  project_id uuid not null references consumer.consumer_projects(id) on delete cascade,
  saved_entity_id uuid not null references consumer.consumer_saved_entities(id) on delete cascade,
  added_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz null,
  project_role text null
    check (project_role is null or char_length(btrim(project_role)) between 1 and 100),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  primary key (project_id, saved_entity_id)
);

create index consumer_project_saved_entities_saved_idx
  on consumer.consumer_project_saved_entities (saved_entity_id, project_id)
  where removed_at is null;
create index consumer_project_saved_entities_project_active_idx
  on consumer.consumer_project_saved_entities (project_id, added_at)
  where removed_at is null;

comment on table consumer.consumer_project_saved_entities is
  'Durable many-to-many Project membership. It neither duplicates a Save nor creates/changes a Watch.';

create trigger consumer_project_saved_entities_set_updated_at
before update on consumer.consumer_project_saved_entities
for each row execute function network.set_updated_at();

create or replace function consumer.enforce_membership_ownership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare
  project_owner uuid;
  saved_owner uuid;
  saved_removed timestamptz;
begin
  select p.user_id into project_owner
  from consumer.consumer_projects p where p.id = new.project_id;
  select s.user_id, s.removed_at into saved_owner, saved_removed
  from consumer.consumer_saved_entities s where s.id = new.saved_entity_id;

  if project_owner is null or saved_owner is null or project_owner <> saved_owner then
    raise exception 'Project and Saved entity must belong to the same consumer'
      using errcode = 'integrity_constraint_violation';
  end if;
  if new.removed_at is null and saved_removed is not null then
    raise exception 'removed Saved entity cannot have an active Project membership'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

revoke all on function consumer.enforce_membership_ownership() from public;

create trigger consumer_project_saved_entities_ownership
before insert or update on consumer.consumer_project_saved_entities
for each row execute function consumer.enforce_membership_ownership();

create table consumer.consumer_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  project_id uuid null references consumer.consumer_projects(id) on delete cascade,
  saved_entity_id uuid null references consumer.consumer_saved_entities(id) on delete cascade,
  note_type text not null default 'general'
    check (note_type in ('general', 'research', 'reminder')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version > 0),
  unique (user_id, client_request_id),
  check (project_id is not null or saved_entity_id is not null)
);

create index consumer_notes_user_updated_idx
  on consumer.consumer_notes (user_id, updated_at desc);
create index consumer_notes_project_idx
  on consumer.consumer_notes (project_id) where project_id is not null;
create index consumer_notes_saved_entity_idx
  on consumer.consumer_notes (saved_entity_id) where saved_entity_id is not null;

comment on table consumer.consumer_notes is
  'Private consumer annotations. No grants, triggers, or foreign keys connect notes to network/public evidence or Business Manager data.';

create trigger consumer_notes_set_updated_at
before update on consumer.consumer_notes
for each row execute function network.set_updated_at();

create or replace function consumer.enforce_note_ownership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare
  project_owner uuid;
  saved_owner uuid;
begin
  if new.project_id is not null then
    select p.user_id into project_owner
    from consumer.consumer_projects p where p.id = new.project_id;
    if project_owner is null or project_owner <> new.user_id then
      raise exception 'note Project must belong to note owner'
        using errcode = 'integrity_constraint_violation';
    end if;
  end if;

  if new.saved_entity_id is not null then
    select s.user_id into saved_owner
    from consumer.consumer_saved_entities s where s.id = new.saved_entity_id;
    if saved_owner is null or saved_owner <> new.user_id then
      raise exception 'note Saved entity must belong to note owner'
        using errcode = 'integrity_constraint_violation';
    end if;
  end if;

  if new.project_id is not null and new.saved_entity_id is not null
    and not exists (
      select 1 from consumer.consumer_project_saved_entities m
      where m.project_id = new.project_id
        and m.saved_entity_id = new.saved_entity_id
        and m.removed_at is null
    ) then
    raise exception 'Project + Saved entity note requires active membership'
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

revoke all on function consumer.enforce_note_ownership() from public;

create trigger consumer_notes_ownership
before insert or update on consumer.consumer_notes
for each row execute function consumer.enforce_note_ownership();

create table consumer.consumer_guest_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_version text not null check (import_version = 'mytrusthub-guest/v1'),
  idempotency_key uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{32}$'),
  submitted_item_count integer not null check (submitted_item_count >= 0),
  imported_item_count integer not null default 0 check (imported_item_count >= 0),
  duplicate_item_count integer not null default 0 check (duplicate_item_count >= 0),
  rejected_item_count integer not null default 0 check (rejected_item_count >= 0),
  status text not null default 'processing' check (status in ('processing', 'completed')),
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz null,
  unique (user_id, idempotency_key)
);

create index consumer_guest_imports_user_created_idx
  on consumer.consumer_guest_imports (user_id, created_at desc);

comment on table consumer.consumer_guest_imports is
  'Minimal idempotent receipt. Raw guest payloads and auth credentials are never retained.';

create table consumer.consumer_guest_import_items (
  import_id uuid not null references consumer.consumer_guest_imports(id) on delete cascade,
  client_item_id text not null check (char_length(btrim(client_item_id)) between 1 and 100),
  selected boolean not null,
  result_status text not null
    check (result_status in ('imported', 'duplicate', 'rejected', 'not_selected')),
  identity_resolution_state text null
    check (identity_resolution_state is null or identity_resolution_state in ('accepted', 'review_required', 'invalid', 'unresolved')),
  network_entity_id uuid null references network.network_entities(id) on delete restrict,
  saved_entity_id uuid null references consumer.consumer_saved_entities(id) on delete set null,
  project_id uuid null references consumer.consumer_projects(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (import_id, client_item_id)
);

create index consumer_guest_import_items_saved_idx
  on consumer.consumer_guest_import_items (saved_entity_id) where saved_entity_id is not null;
create index consumer_guest_import_items_project_idx
  on consumer.consumer_guest_import_items (project_id) where project_id is not null;
create index consumer_guest_import_items_network_entity_idx
  on consumer.consumer_guest_import_items (network_entity_id);

comment on table consumer.consumer_guest_import_items is
  'Sanitized item outcomes only; no names, notes, tokens, source dumps, or raw browser payload.';

-- RLS is defense in depth even though P12 mutations use narrow functions.
alter table consumer.consumer_saved_entities enable row level security;
alter table consumer.consumer_saved_entities force row level security;
alter table consumer.consumer_projects enable row level security;
alter table consumer.consumer_projects force row level security;
alter table consumer.consumer_project_saved_entities enable row level security;
alter table consumer.consumer_project_saved_entities force row level security;
alter table consumer.consumer_notes enable row level security;
alter table consumer.consumer_notes force row level security;
alter table consumer.consumer_guest_imports enable row level security;
alter table consumer.consumer_guest_imports force row level security;
alter table consumer.consumer_guest_import_items enable row level security;
alter table consumer.consumer_guest_import_items force row level security;

create policy consumer_saved_entities_select_own
on consumer.consumer_saved_entities for select to authenticated
using ((select auth.uid()) = user_id);

create policy consumer_projects_select_own
on consumer.consumer_projects for select to authenticated
using ((select auth.uid()) = user_id);

create policy consumer_project_saved_entities_select_own
on consumer.consumer_project_saved_entities for select to authenticated
using (exists (
  select 1 from consumer.consumer_projects p
  where p.id = project_id and p.user_id = (select auth.uid())
));

create policy consumer_notes_select_own
on consumer.consumer_notes for select to authenticated
using ((select auth.uid()) = user_id);

create policy consumer_guest_imports_select_own
on consumer.consumer_guest_imports for select to authenticated
using ((select auth.uid()) = user_id);

create policy consumer_guest_import_items_select_own
on consumer.consumer_guest_import_items for select to authenticated
using (exists (
  select 1 from consumer.consumer_guest_imports i
  where i.id = import_id and i.user_id = (select auth.uid())
));

-- Save/restore is serialized by canonical consumer + terminal entity. Existing
-- rows are restored instead of creating a second lifecycle row.
create or replace function consumer.save_entity(
  p_binding_id uuid,
  p_source_hub text default null,
  p_source_context jsonb default null
)
returns table (saved_entity_id uuid, created boolean, restored boolean)
language plpgsql
security definer
set search_path = pg_catalog, extensions, network, consumer
as $$
declare
  subject uuid := consumer.require_user();
  binding network.network_entity_bindings%rowtype;
  canonical_id uuid;
  existing consumer.consumer_saved_entities%rowtype;
begin
  if p_source_context is not null and (
    jsonb_typeof(p_source_context) <> 'object' or octet_length(p_source_context::text) > 4096
  ) then
    raise exception 'source context must be a small JSON object' using errcode = 'check_violation';
  end if;

  select b.* into binding from network.network_entity_bindings b where b.id = p_binding_id;
  if not found or binding.binding_status not in ('accepted', 'review_required') then
    raise exception 'binding is not Save-eligible' using errcode = 'foreign_key_violation';
  end if;
  canonical_id := network.resolve_canonical_entity(binding.network_entity_id);
  if not exists (
    select 1 from network.network_entities e
    where e.id = canonical_id and e.status in ('active', 'review_required')
  ) then
    raise exception 'network entity is not Save-eligible' using errcode = 'foreign_key_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(subject::text || ':' || canonical_id::text, 0));
  select s.* into existing
  from consumer.consumer_saved_entities s
  where s.user_id = subject
    and network.resolve_canonical_entity(s.network_entity_id) = canonical_id
  order by (s.removed_at is null) desc, s.saved_at
  limit 1
  for update;

  if found then
    update consumer.consumer_saved_entities s
    set removed_at = null,
        source_binding_id = binding.id,
        source_hub = coalesce(p_source_hub, binding.hub),
        source_context = p_source_context,
        identity_resolution_state = case
          when binding.binding_status = 'accepted' then 'accepted' else 'review_required'
        end,
        saved_at = case when existing.removed_at is null then s.saved_at else statement_timestamp() end,
        row_version = s.row_version + 1
    where s.id = existing.id;
    return query select existing.id, false, existing.removed_at is not null;
    return;
  end if;

  insert into consumer.consumer_saved_entities(
    user_id, network_entity_id, source_binding_id, identity_resolution_state,
    source_hub, source_context
  ) values (
    subject, canonical_id, binding.id,
    case when binding.binding_status = 'accepted' then 'accepted' else 'review_required' end,
    coalesce(p_source_hub, binding.hub), p_source_context
  ) returning id into saved_entity_id;
  created := true;
  restored := false;
  return next;
end;
$$;

revoke all on function consumer.save_entity(uuid, text, jsonb) from public;
grant execute on function consumer.save_entity(uuid, text, jsonb) to authenticated;

create or replace function consumer.remove_saved_entity(
  p_saved_entity_id uuid,
  p_expected_row_version bigint
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare
  subject uuid := consumer.require_user();
  next_version bigint;
begin
  if exists (
    select 1 from consumer.consumer_project_saved_entities m
    join consumer.consumer_saved_entities s on s.id = m.saved_entity_id
    where m.saved_entity_id = p_saved_entity_id
      and s.user_id = subject
      and m.removed_at is null
  ) then
    raise exception 'Saved entity still belongs to one or more Projects'
      using errcode = 'integrity_constraint_violation';
  end if;

  update consumer.consumer_saved_entities s
  set removed_at = statement_timestamp(), row_version = s.row_version + 1
  where s.id = p_saved_entity_id
    and s.user_id = subject
    and s.removed_at is null
    and s.row_version = p_expected_row_version
  returning s.row_version into next_version;

  if next_version is null then
    raise exception 'Saved entity not found or stale row version'
      using errcode = 'serialization_failure';
  end if;
  return next_version;
end;
$$;

revoke all on function consumer.remove_saved_entity(uuid, bigint) from public;
grant execute on function consumer.remove_saved_entity(uuid, bigint) to authenticated;

create or replace function consumer.create_project(
  p_creation_key uuid,
  p_name text,
  p_life_event_type text,
  p_location_context jsonb default null,
  p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare
  subject uuid := consumer.require_user();
  project_id uuid;
  existing consumer.consumer_projects%rowtype;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'Project name must be 1 to 120 characters' using errcode = 'check_violation';
  end if;
  if p_life_event_type not in (
    'buying_home', 'moving', 'aging_parent', 'contractor',
    'protecting', 'adviser_research', 'blank'
  ) then
    raise exception 'invalid life event type' using errcode = 'check_violation';
  end if;
  if not consumer.valid_location_context(p_location_context) then
    raise exception 'invalid Project location context' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(subject::text || ':' || p_creation_key::text, 0));
  select * into existing from consumer.consumer_projects p
  where p.user_id = subject and p.creation_key = p_creation_key;
  if found then
    if existing.name <> btrim(p_name)
      or existing.life_event_type <> p_life_event_type
      or existing.location_context is distinct from p_location_context
      or existing.target_date is distinct from p_target_date then
      raise exception 'Project idempotency key reused with different input'
        using errcode = 'integrity_constraint_violation';
    end if;
    return existing.id;
  end if;

  insert into consumer.consumer_projects(
    user_id, creation_key, name, life_event_type, location_context, target_date
  ) values (
    subject, p_creation_key, btrim(p_name), p_life_event_type, p_location_context, p_target_date
  ) returning id into project_id;
  return project_id;
end;
$$;

revoke all on function consumer.create_project(uuid, text, text, jsonb, date) from public;
grant execute on function consumer.create_project(uuid, text, text, jsonb, date) to authenticated;

create or replace function consumer.update_project(
  p_project_id uuid,
  p_expected_row_version bigint,
  p_name text,
  p_location_context jsonb,
  p_target_date date
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare
  subject uuid := consumer.require_user();
  next_version bigint;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120
    or not consumer.valid_location_context(p_location_context) then
    raise exception 'invalid Project update' using errcode = 'check_violation';
  end if;
  update consumer.consumer_projects p
  set name = btrim(p_name), location_context = p_location_context,
      target_date = p_target_date, row_version = p.row_version + 1
  where p.id = p_project_id and p.user_id = subject
    and p.row_version = p_expected_row_version;
  get diagnostics next_version = row_count;
  if next_version <> 1 then
    raise exception 'Project not found or stale row version' using errcode = 'serialization_failure';
  end if;
  select row_version into next_version from consumer.consumer_projects where id = p_project_id;
  return next_version;
end;
$$;

revoke all on function consumer.update_project(uuid, bigint, text, jsonb, date) from public;
grant execute on function consumer.update_project(uuid, bigint, text, jsonb, date) to authenticated;

create or replace function consumer.archive_project(p_project_id uuid, p_expected_row_version bigint)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); next_version bigint;
begin
  update consumer.consumer_projects p
  set status = 'archived', archived_at = statement_timestamp(), row_version = p.row_version + 1
  where p.id = p_project_id and p.user_id = subject
    and p.status = 'active' and p.row_version = p_expected_row_version
  returning p.row_version into next_version;
  if next_version is null then
    raise exception 'active Project not found or stale row version' using errcode = 'serialization_failure';
  end if;
  return next_version;
end;
$$;

revoke all on function consumer.archive_project(uuid, bigint) from public;
grant execute on function consumer.archive_project(uuid, bigint) to authenticated;

create or replace function consumer.restore_project(p_project_id uuid, p_expected_row_version bigint)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); next_version bigint;
begin
  update consumer.consumer_projects p
  set status = 'active', archived_at = null, completed_at = null,
      row_version = p.row_version + 1
  where p.id = p_project_id and p.user_id = subject
    and p.status = 'archived' and p.row_version = p_expected_row_version
  returning p.row_version into next_version;
  if next_version is null then
    raise exception 'archived Project not found or stale row version' using errcode = 'serialization_failure';
  end if;
  return next_version;
end;
$$;

revoke all on function consumer.restore_project(uuid, bigint) from public;
grant execute on function consumer.restore_project(uuid, bigint) to authenticated;

create or replace function consumer.add_saved_entity_to_project(
  p_project_id uuid,
  p_saved_entity_id uuid,
  p_project_role text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); was_active boolean;
begin
  if p_project_role is not null and char_length(btrim(p_project_role)) not between 1 and 100 then
    raise exception 'invalid Project role' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from consumer.consumer_projects p where p.id = p_project_id and p.user_id = subject)
    or not exists (select 1 from consumer.consumer_saved_entities s where s.id = p_saved_entity_id and s.user_id = subject and s.removed_at is null) then
    raise exception 'Project and active Saved entity must belong to current consumer'
      using errcode = 'insufficient_privilege';
  end if;

  select m.removed_at is null into was_active
  from consumer.consumer_project_saved_entities m
  where m.project_id = p_project_id and m.saved_entity_id = p_saved_entity_id;

  insert into consumer.consumer_project_saved_entities(project_id, saved_entity_id, project_role)
  values (p_project_id, p_saved_entity_id, nullif(btrim(p_project_role), ''))
  on conflict (project_id, saved_entity_id) do update
    set removed_at = null,
        added_at = case when consumer.consumer_project_saved_entities.removed_at is null
          then consumer.consumer_project_saved_entities.added_at else statement_timestamp() end,
        project_role = excluded.project_role,
        row_version = consumer.consumer_project_saved_entities.row_version + 1
    where consumer.consumer_project_saved_entities.removed_at is not null
      or consumer.consumer_project_saved_entities.project_role is distinct from excluded.project_role;
  return coalesce(not was_active, true);
end;
$$;

revoke all on function consumer.add_saved_entity_to_project(uuid, uuid, text) from public;
grant execute on function consumer.add_saved_entity_to_project(uuid, uuid, text) to authenticated;

create or replace function consumer.remove_saved_entity_from_project(
  p_project_id uuid,
  p_saved_entity_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); affected integer;
begin
  if not exists (select 1 from consumer.consumer_projects p where p.id = p_project_id and p.user_id = subject)
    or not exists (select 1 from consumer.consumer_saved_entities s where s.id = p_saved_entity_id and s.user_id = subject) then
    raise exception 'Project and Saved entity must belong to current consumer'
      using errcode = 'insufficient_privilege';
  end if;
  update consumer.consumer_project_saved_entities m
  set removed_at = statement_timestamp(), row_version = m.row_version + 1
  where m.project_id = p_project_id and m.saved_entity_id = p_saved_entity_id
    and m.removed_at is null;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function consumer.remove_saved_entity_from_project(uuid, uuid) from public;
grant execute on function consumer.remove_saved_entity_from_project(uuid, uuid) to authenticated;

create or replace function consumer.create_note(
  p_client_request_id uuid,
  p_project_id uuid,
  p_saved_entity_id uuid,
  p_note_type text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); note_id uuid; existing consumer.consumer_notes%rowtype;
begin
  if p_note_type not in ('general', 'research', 'reminder')
    or char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000
    or (p_project_id is null and p_saved_entity_id is null) then
    raise exception 'invalid private note' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(subject::text || ':' || p_client_request_id::text, 0));
  select * into existing from consumer.consumer_notes n
  where n.user_id = subject and n.client_request_id = p_client_request_id;
  if found then
    if existing.project_id is distinct from p_project_id
      or existing.saved_entity_id is distinct from p_saved_entity_id
      or existing.note_type <> p_note_type or existing.body <> btrim(p_body) then
      raise exception 'note idempotency key reused with different input'
        using errcode = 'integrity_constraint_violation';
    end if;
    return existing.id;
  end if;
  insert into consumer.consumer_notes(
    user_id, client_request_id, project_id, saved_entity_id, note_type, body
  ) values (
    subject, p_client_request_id, p_project_id, p_saved_entity_id, p_note_type, btrim(p_body)
  ) returning id into note_id;
  return note_id;
end;
$$;

revoke all on function consumer.create_note(uuid, uuid, uuid, text, text) from public;
grant execute on function consumer.create_note(uuid, uuid, uuid, text, text) to authenticated;

create or replace function consumer.update_note(
  p_note_id uuid,
  p_expected_row_version bigint,
  p_note_type text,
  p_body text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); next_version bigint;
begin
  if p_note_type not in ('general', 'research', 'reminder')
    or char_length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'invalid private note update' using errcode = 'check_violation';
  end if;
  update consumer.consumer_notes n
  set note_type = p_note_type, body = btrim(p_body), row_version = n.row_version + 1
  where n.id = p_note_id and n.user_id = subject and n.row_version = p_expected_row_version
  returning n.row_version into next_version;
  if next_version is null then
    raise exception 'note not found or stale row version' using errcode = 'serialization_failure';
  end if;
  return next_version;
end;
$$;

revoke all on function consumer.update_note(uuid, bigint, text, text) from public;
grant execute on function consumer.update_note(uuid, bigint, text, text) to authenticated;

create or replace function consumer.delete_note(p_note_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, consumer
as $$
declare subject uuid := consumer.require_user(); affected integer;
begin
  delete from consumer.consumer_notes n where n.id = p_note_id and n.user_id = subject;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function consumer.delete_note(uuid) from public;
grant execute on function consumer.delete_note(uuid) to authenticated;

create or replace function consumer.validate_guest_payload(p_payload jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  generated_at timestamptz;
  expires_at timestamptz;
  item jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'guest payload must be a JSON object' using errcode = 'check_violation';
  end if;
  if octet_length(p_payload::text) > 262144 then
    raise exception 'guest payload exceeds 256 KB' using errcode = 'program_limit_exceeded';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_payload) k(key)
    where k.key not in ('version', 'generated_at', 'expires_at', 'items')
  ) then
    raise exception 'guest payload contains unsupported or sensitive fields' using errcode = 'check_violation';
  end if;
  if p_payload->>'version' <> 'mytrusthub-guest/v1' then
    raise exception 'unsupported guest payload version' using errcode = 'check_violation';
  end if;
  begin
    generated_at := (p_payload->>'generated_at')::timestamptz;
    expires_at := (p_payload->>'expires_at')::timestamptz;
  exception when others then
    raise exception 'guest payload timestamps are invalid' using errcode = 'invalid_datetime_format';
  end;
  if generated_at > statement_timestamp() + interval '5 minutes'
    or expires_at <= statement_timestamp()
    or expires_at > generated_at + interval '90 days' then
    raise exception 'guest payload is expired or outside retention window' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array'
    or jsonb_array_length(p_payload->'items') > 100 then
    raise exception 'guest items must be an array of at most 100 items' using errcode = 'check_violation';
  end if;
  if (
    select count(*) <> count(distinct value->>'client_item_id')
    from jsonb_array_elements(p_payload->'items')
  ) then
    raise exception 'guest client item IDs must be unique' using errcode = 'unique_violation';
  end if;
  for item in select value from jsonb_array_elements(p_payload->'items') loop
    if jsonb_typeof(item) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(item) k(key)
        where k.key not in ('client_item_id', 'item_type', 'hub', 'specialist_entity_type', 'specialist_entity_id')
      )
      or char_length(btrim(coalesce(item->>'client_item_id', ''))) not between 1 and 100 then
      raise exception 'guest item schema is invalid or contains sensitive fields' using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

revoke all on function consumer.validate_guest_payload(jsonb) from public;

create or replace function consumer.preview_guest_import(p_payload jsonb)
returns table (
  client_item_id text,
  item_status text,
  valid boolean,
  importable boolean,
  binding_id uuid,
  network_entity_id uuid,
  existing_saved_entity_id uuid,
  project_assignment_eligible boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, network, consumer
as $$
declare
  subject uuid := consumer.require_user();
  item jsonb;
  chosen network.network_entity_bindings%rowtype;
  terminal_id uuid;
  terminal_status text;
  duplicate_id uuid;
begin
  perform consumer.validate_guest_payload(p_payload);
  for item in select value from jsonb_array_elements(p_payload->'items') loop
    client_item_id := item->>'client_item_id';
    item_status := null; valid := false; importable := false; binding_id := null;
    network_entity_id := null; existing_saved_entity_id := null;
    project_assignment_eligible := false;

    if item->>'item_type' <> 'saved_entity'
      or item->>'hub' not in ('move', 'lender', 'insurance', 'contractor', 'senior', 'investor')
      or char_length(btrim(coalesce(item->>'specialist_entity_type', ''))) not between 1 and 64
      or char_length(btrim(coalesce(item->>'specialist_entity_id', ''))) not between 1 and 300 then
      item_status := 'invalid';
      return next;
      continue;
    end if;

    select b.* into chosen
    from network.network_entity_bindings b
    where b.hub = item->>'hub'
      and b.specialist_entity_type = item->>'specialist_entity_type'
      and b.specialist_entity_id = item->>'specialist_entity_id'
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp())
    order by case b.binding_status
      when 'accepted' then 1 when 'review_required' then 2
      when 'superseded' then 3 else 4 end, b.created_at desc
    limit 1;

    if not found then
      item_status := 'unresolved';
      return next;
      continue;
    end if;
    binding_id := chosen.id;
    terminal_id := network.resolve_canonical_entity(chosen.network_entity_id);
    select e.status into terminal_status from network.network_entities e where e.id = terminal_id;
    network_entity_id := terminal_id;

    if chosen.binding_status in ('invalid', 'superseded')
      or terminal_status not in ('active', 'review_required') then
      item_status := 'invalid';
      return next;
      continue;
    end if;

    select s.id into duplicate_id
    from consumer.consumer_saved_entities s
    where s.user_id = subject and s.removed_at is null
      and network.resolve_canonical_entity(s.network_entity_id) = terminal_id
    order by s.saved_at limit 1;
    if duplicate_id is not null then
      item_status := 'duplicate'; valid := true; importable := true;
      existing_saved_entity_id := duplicate_id; project_assignment_eligible := true;
      return next;
      continue;
    end if;

    item_status := case
      when chosen.binding_status = 'accepted' and terminal_status = 'active' then 'accepted'
      else 'review_required' end;
    valid := true; importable := true; project_assignment_eligible := true;
    return next;
  end loop;
end;
$$;

revoke all on function consumer.preview_guest_import(jsonb) from public;
grant execute on function consumer.preview_guest_import(jsonb) to authenticated;

create or replace function consumer.commit_guest_import(
  p_payload jsonb,
  p_selected_item_ids text[],
  p_idempotency_key uuid,
  p_project_id uuid default null
)
returns table (
  import_id uuid,
  submitted_item_count integer,
  imported_item_count integer,
  duplicate_item_count integer,
  rejected_item_count integer
)
language plpgsql
security definer
set search_path = pg_catalog, network, consumer
as $$
declare
  subject uuid := consumer.require_user();
  fingerprint text;
  existing consumer.consumer_guest_imports%rowtype;
  preview record;
  chosen boolean;
  saved_result record;
  saved_id uuid;
  imported_count integer := 0;
  duplicate_count integer := 0;
  rejected_count integer := 0;
  submitted_count integer;
begin
  perform consumer.validate_guest_payload(p_payload);
  if p_selected_item_ids is null then p_selected_item_ids := array[]::text[]; end if;
  if (select count(*) <> count(distinct value) from unnest(p_selected_item_ids) value) then
    raise exception 'selected guest item IDs must be unique' using errcode = 'unique_violation';
  end if;
  if exists (
    select 1 from unnest(p_selected_item_ids) selected(value)
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'items') item
      where item->>'client_item_id' = selected.value
    )
  ) then
    raise exception 'selected guest item is not in payload' using errcode = 'foreign_key_violation';
  end if;
  if p_project_id is not null and not exists (
    select 1 from consumer.consumer_projects p where p.id = p_project_id and p.user_id = subject
  ) then
    raise exception 'target Project does not belong to current consumer'
      using errcode = 'insufficient_privilege';
  end if;

  submitted_count := jsonb_array_length(p_payload->'items');
  fingerprint := md5(p_payload::text || '|' || to_jsonb(p_selected_item_ids)::text || '|' || coalesce(p_project_id::text, 'unfiled'));
  perform pg_advisory_xact_lock(hashtextextended(subject::text || ':' || p_idempotency_key::text, 0));
  select * into existing from consumer.consumer_guest_imports i
  where i.user_id = subject and i.idempotency_key = p_idempotency_key;
  if found then
    if existing.request_fingerprint <> fingerprint then
      raise exception 'guest import idempotency key reused with different request'
        using errcode = 'integrity_constraint_violation';
    end if;
    return query select existing.id, existing.submitted_item_count,
      existing.imported_item_count, existing.duplicate_item_count, existing.rejected_item_count;
    return;
  end if;

  insert into consumer.consumer_guest_imports(
    user_id, import_version, idempotency_key, request_fingerprint, submitted_item_count
  ) values (
    subject, 'mytrusthub-guest/v1', p_idempotency_key, fingerprint, submitted_count
  ) returning id into import_id;

  for preview in select * from consumer.preview_guest_import(p_payload) loop
    chosen := preview.client_item_id = any(p_selected_item_ids);
    saved_id := null;
    if not chosen then
      insert into consumer.consumer_guest_import_items(
        import_id, client_item_id, selected, result_status,
        identity_resolution_state, network_entity_id
      ) values (
        import_id, preview.client_item_id, false, 'not_selected',
        case when preview.item_status in ('accepted', 'review_required', 'invalid', 'unresolved') then preview.item_status else null end,
        preview.network_entity_id
      );
      continue;
    end if;

    if not preview.importable then
      rejected_count := rejected_count + 1;
      insert into consumer.consumer_guest_import_items(
        import_id, client_item_id, selected, result_status,
        identity_resolution_state, network_entity_id
      ) values (
        import_id, preview.client_item_id, true, 'rejected',
        case when preview.item_status in ('invalid', 'unresolved') then preview.item_status else null end,
        preview.network_entity_id
      );
      continue;
    end if;

    if preview.item_status = 'duplicate' then
      saved_id := preview.existing_saved_entity_id;
      duplicate_count := duplicate_count + 1;
    else
      select * into saved_result from consumer.save_entity(preview.binding_id, null, '{"origin":"guest_import"}'::jsonb);
      saved_id := saved_result.saved_entity_id;
      imported_count := imported_count + 1;
    end if;
    if p_project_id is not null then
      perform consumer.add_saved_entity_to_project(p_project_id, saved_id, null);
    end if;
    insert into consumer.consumer_guest_import_items(
      import_id, client_item_id, selected, result_status, identity_resolution_state,
      network_entity_id, saved_entity_id, project_id
    ) values (
      import_id, preview.client_item_id, true,
      case when preview.item_status = 'duplicate' then 'duplicate' else 'imported' end,
      case when preview.item_status = 'duplicate' then
        (select s.identity_resolution_state from consumer.consumer_saved_entities s where s.id = saved_id)
        else preview.item_status end,
      preview.network_entity_id, saved_id, p_project_id
    );
  end loop;

  update consumer.consumer_guest_imports i
  set imported_item_count = imported_count,
      duplicate_item_count = duplicate_count,
      rejected_item_count = rejected_count,
      status = 'completed', completed_at = statement_timestamp()
  where i.id = import_id;
  return query select import_id, submitted_count, imported_count, duplicate_count, rejected_count;
end;
$$;

revoke all on function consumer.commit_guest_import(jsonb, text[], uuid, uuid) from public;
grant execute on function consumer.commit_guest_import(jsonb, text[], uuid, uuid) to authenticated;

create or replace function consumer.list_saved_entities()
returns table (
  saved_entity_id uuid,
  stored_network_entity_id uuid,
  resolved_network_entity_id uuid,
  canonical_name text,
  primary_hub text,
  identity_resolution_state text,
  saved_at timestamptz,
  removed_at timestamptz,
  project_ids uuid[]
)
language sql
stable
security definer
set search_path = pg_catalog, network, consumer
as $$
  select s.id, s.network_entity_id, terminal.id, terminal.canonical_name,
    terminal.primary_hub, s.identity_resolution_state, s.saved_at, s.removed_at,
    coalesce(array_agg(m.project_id order by m.project_id) filter (where m.removed_at is null), array[]::uuid[])
  from consumer.consumer_saved_entities s
  join network.network_entities terminal on terminal.id = network.resolve_canonical_entity(s.network_entity_id)
  left join consumer.consumer_project_saved_entities m on m.saved_entity_id = s.id
  where s.user_id = consumer.require_user()
  group by s.id, terminal.id, terminal.canonical_name, terminal.primary_hub
  order by s.saved_at desc;
$$;

revoke all on function consumer.list_saved_entities() from public;
grant execute on function consumer.list_saved_entities() to authenticated;

create or replace function consumer.list_projects()
returns table (
  project_id uuid,
  name text,
  life_event_type text,
  status text,
  saved_count bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, consumer
as $$
  select p.id, p.name, p.life_event_type, p.status,
    count(m.saved_entity_id) filter (where m.removed_at is null and s.removed_at is null),
    p.updated_at
  from consumer.consumer_projects p
  left join consumer.consumer_project_saved_entities m on m.project_id = p.id
  left join consumer.consumer_saved_entities s on s.id = m.saved_entity_id
  where p.user_id = consumer.require_user()
  group by p.id
  order by p.updated_at desc;
$$;

revoke all on function consumer.list_projects() from public;
grant execute on function consumer.list_projects() to authenticated;

-- Authenticated receives read-only base-table access, constrained by RLS, plus
-- the narrow mutation/read functions above. There are no direct write grants.
grant select on
  consumer.consumer_saved_entities,
  consumer.consumer_projects,
  consumer.consumer_project_saved_entities,
  consumer.consumer_notes,
  consumer.consumer_guest_imports,
  consumer.consumer_guest_import_items
to authenticated;

revoke all on
  consumer.consumer_saved_entities,
  consumer.consumer_projects,
  consumer.consumer_project_saved_entities,
  consumer.consumer_notes,
  consumer.consumer_guest_imports,
  consumer.consumer_guest_import_items
from anon;

commit;
