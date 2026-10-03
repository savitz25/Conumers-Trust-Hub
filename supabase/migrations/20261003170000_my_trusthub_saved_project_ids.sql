-- My TrustHub: list_saved_entities() must return an EMPTY project_ids array for
-- a Saved entity with no Project membership.
--
-- The previous aggregate filtered only on m.removed_at IS NULL. For a Saved
-- entity with no membership the LEFT JOIN yields one all-NULL row, which passes
-- that filter, so project_ids came back as {NULL} (length 1) instead of {}.
-- Consumers then showed "1 Projects", hid Unsave and miscounted Unfiled.
--
-- Function replacement only: same signature, owner, security, search_path and
-- grants. No table, policy, data or other function changes.
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
    coalesce(
      array_agg(m.project_id order by m.project_id)
        filter (where m.project_id is not null and m.removed_at is null),
      array[]::uuid[])
  from consumer.consumer_saved_entities s
  join network.network_entities terminal on terminal.id = network.resolve_canonical_entity(s.network_entity_id)
  left join consumer.consumer_project_saved_entities m on m.saved_entity_id = s.id
  where s.user_id = consumer.require_user()
  group by s.id, terminal.id, terminal.canonical_name, terminal.primary_hub
  order by s.saved_at desc;
$$;

revoke all on function consumer.list_saved_entities() from public;
grant execute on function consumer.list_saved_entities() to authenticated;
