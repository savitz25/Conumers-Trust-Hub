-- MY TRUSTHUB V2 — PER-HUB ACCOUNT CONTEXT ISSUER (ROLLBACK, operator).
-- NOT APPLIED by this build. Target qvvxvbcdmbjzrgvwjatw.
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--
-- Removes exactly the one function created by
-- 15-ask-prod-hub-account-context-forward.sql. No row is touched and
-- prod_issue_context() is untouched, so Move is unaffected. After it, a Lender
-- or Insurance Save cannot obtain an account context and fails closed (device
-- Save only). Turn the Lender and Insurance release gates off first.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production authorization required: set v23.approved_project';
  end if;
  if to_regprocedure('v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text)') is null then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_PRECONDITION_FAIL: nothing to remove';
  end if;
end $$;
drop function v23_private.prod_hub_issue_context(jsonb,uuid,uuid,text);
do $$ begin
  if to_regprocedure('v23_private.prod_issue_context(jsonb,uuid,uuid)') is null then
    raise exception 'V23_PROD_HUB_CONTEXT_ROLLBACK_FAIL: the Move issuer must remain';
  end if;
  raise notice 'V23_PROD_HUB_CONTEXT_ROLLED_BACK';
end $$;
commit;
