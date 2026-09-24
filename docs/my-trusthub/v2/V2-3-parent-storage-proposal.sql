-- REVIEW PROPOSAL ONLY. Not a migration and NOT APPLIED to any database.
-- An isolated migration/least-privilege review must precede runtime binding.
-- Source-owned manifests remain at the specialist; stage payload here represents
-- the authenticated parent confirmation snapshot obtained through its BFF.
-- No credentials, role creation, grants, policies, or production changes.
begin;
create table ops.v23_profile_runtime_records (
  kind text not null check (kind in ('stage','continuation','grant','receipt')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=131072),
  created_at timestamptz not null default statement_timestamp(),
  primary key(kind,key_hash)
);
alter table ops.v23_profile_runtime_records enable row level security;
alter table ops.v23_profile_runtime_records force row level security;
revoke all on ops.v23_profile_runtime_records from public,anon,authenticated;
create table ops.v23_profile_runtime_quota (
  bucket text primary key check (bucket ~ '^[a-f0-9]{64}$'),
  window_start bigint not null,
  count bigint not null check(count>0)
);
alter table ops.v23_profile_runtime_quota enable row level security;
alter table ops.v23_profile_runtime_quota force row level security;
revoke all on ops.v23_profile_runtime_quota from public,anon,authenticated;
-- No permissive policy: unavailable until the parent-only capability is reviewed.
-- Review expiration/retention indexes and bounded cleanup together with receipt
-- recovery across renewed sessions. Do not erase receipts at staging expiry.
commit;
