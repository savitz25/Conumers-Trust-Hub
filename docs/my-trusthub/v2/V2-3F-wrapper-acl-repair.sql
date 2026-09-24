-- Approved isolated repair ONLY: caller must assert project xkkiicsassizmakcvxml.
-- Do not replay the migration. Does not change its deployed ledger entry.
-- Execute appended hosted catalog assertions BEFORE the final COMMIT.
begin;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
revoke all on function v23_private.save_profile(uuid) from public;
grant execute on function v23_private.save_profile(uuid) to myth_v23_executor;
revoke all on function v23_private.add_project(uuid,uuid) from public;
grant execute on function v23_private.add_project(uuid,uuid) to myth_v23_executor;
revoke all on function v23_private.consume_context(jsonb) from public;
grant execute on function v23_private.consume_context(jsonb) to myth_v23_executor;
reset role;
revoke myth_v23_foundation from current_user granted by current_user;
-- No COMMIT here: append supabase/tests/v23_hosted_security_assertions.sql,
-- then COMMIT in the same request; any error must abort this transaction.
