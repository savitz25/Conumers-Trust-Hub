-- UNRUN. Run only in separately approved isolated PostgreSQL after proposal.
begin;
do $$ begin
  if exists(select 1 from pg_roles where rolname='myth_v23_receipt_consumer'
    and (rolsuper or rolbypassrls or rolcanlogin or rolcreaterole)) then
    raise exception 'unsafe role';
  end if;
  if not exists(select 1 from pg_class where oid='ops.v23_profile_runtime_records'::regclass
    and relrowsecurity and relforcerowsecurity) then raise exception 'RLS not forced'; end if;
  if has_table_privilege('myth_v23_receipt_consumer','consumer.consumer_saved_entities','INSERT')
    or has_table_privilege('myth_v23_receipt_consumer','consumer.consumer_notes','SELECT')
    or has_table_privilege('anon','ops.v23_profile_runtime_records','SELECT')
    or has_table_privilege('authenticated','ops.v23_profile_runtime_records','SELECT') then
    raise exception 'overbroad privilege';
  end if;
end $$;
set local role myth_v23_receipt_consumer;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
values('receipt',repeat('a',64),'{"owner":"11111111-1111-4111-8111-111111111111"}');
do $$ begin
  begin
    insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
    values('receipt',repeat('b',64),'{"owner":"22222222-2222-4222-8222-222222222222"}');
    raise exception 'cross-owner write passed';
  exception when insufficient_privilege then null; end;
  begin
    insert into ops.v23_profile_runtime_records(kind,key_hash,payload)
    values('grant',repeat('c',64),'{"owner":"11111111-1111-4111-8111-111111111111"}');
    raise exception 'broker write passed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  if exists(select 1 from ops.v23_profile_runtime_records where key_hash=repeat('a',64)) then
    raise exception 'cross-owner read passed'; end if;
end $$;
rollback;
