-- MY TRUSTHUB V2 PRODUCTION — EXACT MOVE MOVER BINDING RESOLVER (ROLLBACK, operator).
-- Target qvvxvbcdmbjzrgvwjatw. Removes exactly the three objects created by
-- 09-ask-prod-move-binding-resolver-forward.sql. Turn the Move widening canary
-- OFF first: the application calls this function on every profile-save request
-- and reports "unavailable" once it is gone. Nothing else is touched; the
-- one-mover function and policies from 02 remain.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
begin;
do $$ begin
  if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
end $$;
drop function if exists v23_private.prod_move_binding_for(text);
drop policy if exists prod_move_mover_bindings on network.network_entity_bindings;
drop policy if exists prod_move_mover_entities on network.network_entities;
do $$ begin
  if to_regprocedure('v23_private.prod_move_binding_for(text)') is not null
     or exists(select 1 from pg_policies where schemaname='network' and policyname in ('prod_move_mover_bindings','prod_move_mover_entities')) then
    raise exception 'V23_PROD_MOVE_RESOLVER_ROLLBACK_FAIL';
  end if;
  raise notice 'V23_PROD_MOVE_BINDING_RESOLVER_ROLLED_BACK';
end $$;
commit;
