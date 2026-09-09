-- P11B isolated-environment rollback.
-- Run only before any dependent My TrustHub migrations exist.
-- btree_gist is intentionally retained because extensions may be shared.

begin;

drop schema if exists ops cascade;
drop schema if exists consumer cascade;
drop schema if exists network cascade;

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
    if exists (select 1 from pg_catalog.pg_roles where rolname = role_name) then
      execute format('drop role %I', role_name);
    end if;
  end loop;
end;
$$;

commit;
