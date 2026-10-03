-- PREPARED ONLY. Isolated preview project xkkiicsassizmakcvxml; never production.
-- Exact Move mover binding resolver for the isolated pair: the same three
-- objects as docs/my-trusthub/v2/production/09-ask-prod-move-binding-resolver-forward.sql
-- with preview identifiers. Requires ports-forward.sql. The application calls
-- v23_private.preview_move_binding_for(text); until this is applied the
-- isolated pair reports "unavailable".
--   select set_config('v23.approved_project','xkkiicsassizmakcvxml',false);
-- Rollback: drop function v23_private.preview_move_binding_for(text); drop the
-- two preview_move_mover_* policies.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
    raise exception 'Explicit isolated apply authorization required: set v23.approved_project';
  end if;
  if to_regrole('myth_v23_preview_reader') is null or to_regrole('myth_v23_authorizer') is null or to_regrole('myth_v23_executor') is null
     or to_regprocedure('v23_private.preview_move_binding()') is null then
    raise exception 'V23_PREVIEW_MOVE_RESOLVER_PRECONDITION_FAIL: ports-forward.sql must be applied first';
  end if;
  if to_regprocedure('v23_private.preview_move_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('preview_move_mover_bindings','preview_move_mover_entities')) then
    raise exception 'V23_PREVIEW_MOVE_RESOLVER_PRECONDITION_FAIL: already applied; review, do not re-create';
  end if;
end $$;

create policy preview_move_mover_bindings on network.network_entity_bindings for select to myth_v23_preview_reader
 using(hub='move' and (identifier_namespace='fmcsa.usdot' or specialist_entity_id ~ '^usdot-[1-9][0-9]{0,8}$'));
create policy preview_move_mover_entities on network.network_entities for select to myth_v23_preview_reader
 using(exists(select 1 from network.network_entity_bindings b where b.network_entity_id=network_entities.id
   and b.hub='move' and (b.identifier_namespace='fmcsa.usdot' or b.specialist_entity_id ~ '^usdot-[1-9][0-9]{0,8}$')));

create function v23_private.preview_move_binding_for(native_id text)
returns table(id uuid,network_entity_id uuid,binding_status text,specialist_entity_type text,specialist_entity_id text,
  identifier_namespace text,source_identifier text,jurisdiction text,entity_status text)
language sql stable security definer set search_path=pg_catalog,network as $$
 select b.id,e.id,b.binding_status,b.specialist_entity_type,b.specialist_entity_id,
   b.identifier_namespace,b.source_identifier,b.jurisdiction,e.status
 from network.network_entity_bindings b
 join network.network_entities e on e.id=b.network_entity_id
 where $1 ~ '^usdot-[1-9][0-9]{0,8}$'
   and b.hub='move'
   and (b.specialist_entity_id=$1 or (b.identifier_namespace='fmcsa.usdot' and b.source_identifier_normalized=substr($1,7)))
   and b.binding_status in ('accepted','review_required')
   and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
 order by b.id limit 3;
$$;
revoke all on function v23_private.preview_move_binding_for(text) from public,anon,authenticated;
grant execute on function v23_private.preview_move_binding_for(text) to myth_v23_authorizer,myth_v23_executor;
grant create on schema v23_private to myth_v23_preview_reader;
grant myth_v23_preview_reader to current_user with admin false,inherit false,set true granted by current_user;
alter function v23_private.preview_move_binding_for(text) owner to myth_v23_preview_reader;
revoke create on schema v23_private from myth_v23_preview_reader;
revoke myth_v23_preview_reader from current_user granted by current_user;

-- Verification. Any failure aborts the whole transaction.
do $$
declare reference record; n integer;
begin
  if has_function_privilege('public','v23_private.preview_move_binding_for(text)','EXECUTE')
     or has_function_privilege('anon','v23_private.preview_move_binding_for(text)','EXECUTE')
     or has_function_privilege('authenticated','v23_private.preview_move_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_authorizer','v23_private.preview_move_binding_for(text)','EXECUTE')
     or not has_function_privilege('myth_v23_executor','v23_private.preview_move_binding_for(text)','EXECUTE') then
    raise exception 'V23_PREVIEW_MOVE_RESOLVER_ACL_FAIL';
  end if;
  if exists(select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='network'
      and c.relname in ('network_entities','network_entity_bindings')
      and (has_table_privilege('myth_v23_authorizer',c.oid,'SELECT') or has_table_privilege('myth_v23_executor',c.oid,'SELECT')
        or has_table_privilege('myth_v23_parent_preview',c.oid,'SELECT'))) then
    raise exception 'V23_PREVIEW_MOVE_RESOLVER_ACL_FAIL: a runtime role can read network tables directly';
  end if;
  -- Impossible and malformed identities return nothing.
  select count(*) into n from v23_private.preview_move_binding_for('usdot-0'); if n<>0 then raise exception 'V23_PREVIEW_MOVE_RESOLVER_FAIL: impossible identity matched'; end if;
  select count(*) into n from v23_private.preview_move_binding_for('%'); if n<>0 then raise exception 'V23_PREVIEW_MOVE_RESOLVER_FAIL: wildcard matched'; end if;
  -- The Hindman reference must resolve exactly as the proven one-mover function does.
  select count(*) into n from v23_private.preview_move_binding_for('usdot-1002530');
  if n<>1 then raise exception 'V23_PREVIEW_MOVE_RESOLVER_FAIL: Hindman reference returned % rows, expected 1',n; end if;
  select * into reference from v23_private.preview_move_binding_for('usdot-1002530');
  if reference.binding_status<>'accepted' or reference.specialist_entity_type<>'mover' or reference.specialist_entity_id<>'usdot-1002530'
     or reference.identifier_namespace<>'fmcsa.usdot' or reference.source_identifier<>'1002530' or reference.jurisdiction<>'US'
     or reference.entity_status<>'active'
     or not exists(select 1 from v23_private.preview_move_binding() old where old.id=reference.id and old.network_entity_id=reference.network_entity_id) then
    raise exception 'V23_PREVIEW_MOVE_RESOLVER_FAIL: Hindman reference does not match the proven binding';
  end if;
  raise notice 'V23_PREVIEW_MOVE_BINDING_RESOLVER_APPLIED';
end $$;
commit;
