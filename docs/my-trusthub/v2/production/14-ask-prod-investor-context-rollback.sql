-- MY TRUSTHUB V2 — INVESTOR ACCOUNT-CONTEXT ISSUER (ROLLBACK, operator).
-- NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Removes exactly the one function created by
-- 14-ask-prod-investor-context-forward.sql. No row is touched and
-- prod_issue_context() is untouched. After it, an Investor Save cannot obtain
-- an account context and fails closed. Turn the Investor release gate off first.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if to_regprocedure('v23_private.prod_investor_issue_context(jsonb,uuid,uuid)') is null then
    raise exception 'V23_PROD_INVESTOR_CONTEXT_ROLLBACK_PRECONDITION_FAIL: nothing to remove';
  end if;
end $$;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
drop function v23_private.prod_investor_issue_context(jsonb,uuid,uuid);
reset role;
revoke myth_v23_foundation from current_user granted by current_user;
do $$ begin
  if to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is null then
    raise exception 'V23_PROD_INVESTOR_CONTEXT_ROLLBACK_FAIL: the Move issuer must remain';
  end if;
  raise notice 'V23_PROD_INVESTOR_CONTEXT_ROLLED_BACK';
end $$;
commit;
