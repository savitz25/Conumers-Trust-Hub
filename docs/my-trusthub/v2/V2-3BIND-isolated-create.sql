-- APPROVED IDENTITY; EXECUTION NOT AUTHORIZED. Not a migration or automatic seed.
-- Parent baseline: 394a3c55c11a8f3b2ac1971cb6f94c3f0d98952e.
-- Execute only after separate approval pins the isolated host/project/database,
-- operator and fresh source evidence. NEVER use production parent credentials.
-- psql runner must use ON_ERROR_STOP=1. Any failure requires ROLLBACK, not retry
-- with modified identity fields. No COMMIT may be issued after a failed check.
begin isolation level serializable;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

-- INTENTIONAL EXECUTION STOP. Replace ONLY in a newly reviewed target-bound copy
-- after environment approval. SQL cannot independently prove a remote host's
-- project identity from an operator-supplied GUC or current_database()='postgres'.
do $$ begin
  raise exception 'V2-3BIND: isolated environment not approved/pinned; creation forbidden';
end $$;

set local role myth_identity_governor;
-- Existing P11 role/policies/audit triggers only. No new grants or bypass roles.
lock table network.network_entities, network.network_entity_bindings
  in share row exclusive mode;

do $$
declare preflight_at timestamptz;
begin
  -- Server/operator attestations ONLY, populated by the later reviewed runner
  -- after querying the authoritative source. They are not independent DB proof.
  -- Required exact fresh result: one Company row, same slug, DOT and MC,
  -- PUBLISHABLE; source corroboration and approved organization/mover grain.
  preflight_at := nullif(current_setting('v23bind.preflight_checked_at',true),'')::timestamptz;
  if preflight_at is null or preflight_at > clock_timestamp()
     or preflight_at < clock_timestamp()-interval '2 minutes'
     or current_setting('v23bind.candidate_unchanged',true) is distinct from 'true'
     or nullif(current_setting('v23bind.evidence_ref',true),'') is null
  then raise exception 'V2-3BIND: fresh approved source preflight required'; end if;

  if exists(select 1 from network.network_entities
      where primary_hub='move'
        or canonical_public_profile_ref='/companies/hindman-isaacs-moving-storage-inc')
    or exists(select 1 from network.network_entity_bindings
      where hub='move' or specialist_entity_id='usdot-1002530'
        or regexp_replace(source_identifier_normalized,'[^0-9]','','g') in ('1002530','421784'))
    or exists(select 1 from network.network_entity_redirects)
  then raise exception 'V2-3BIND: registry evidence changed; stop for steward review'; end if;
end $$;

-- A + B are atomic. IDs and generated columns are not supplied by the operator.
-- Existing P11 triggers record the actual governor actor and governance events.
with new_entity as (
  insert into network.network_entities(
    entity_type,canonical_name,primary_hub,jurisdiction,canonical_public_profile_ref,status
  ) values (
    'organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US',
    '/companies/hindman-isaacs-moving-storage-inc','active'
  ) returning id
), new_binding as (
  insert into network.network_entity_bindings(
    network_entity_id,hub,specialist_entity_type,specialist_entity_id,
    identifier_namespace,source_identifier,jurisdiction,binding_status,confidence,
    resolution_note,valid_from,valid_to,provenance_ref
  ) select id,'move','mover','usdot-1002530','fmcsa.usdot','1002530','US','accepted',null,
    'V2-3BIND: canonical organization; Move specialist class mover; exact Company.id usdot-1002530. Current PUBLISHABLE record corroborated against FMCSA Company Census az4n-8mr2 on 2026-09-21T14:03:02Z: USDOT 1002530, MC 421784, household cargo X. No scoped identifier conflicts found. Historical ingestion row hash/version unavailable. Create new organization and exact binding; no fuzzy matching.',
    transaction_timestamp(),null,
    'https://data.transportation.gov/resource/az4n-8mr2.json?dot_number=1002530'
  from new_entity returning id,network_entity_id,valid_from,created_by
)
select network_entity_id,id as binding_id,valid_from,created_by from new_binding;
commit;

-- A second run deliberately stops on existing records. Never silently reuse,
-- upsert, delete or recreate on retry. Recover uncertain outcomes by read-only
-- exact binding/entity/audit lookup. No Save/Project/Watch/Auth rows are created.
