-- UNAPPLIED hosted rollback: disable V2-3 ingress first; verify exact approved DB.
-- Operational rollback revokes capabilities, retaining all Saved/Project research
-- and durable metadata. It intentionally does NOT drop tables or role identities.
begin;
revoke all on schema v23_private from myth_v23_authorizer,myth_v23_executor,
  myth_v23_foundation,myth_v23_browser_store,myth_v23_cleanup;
revoke all on all tables in schema v23_private from myth_v23_authorizer,
  myth_v23_executor,myth_v23_foundation,myth_v23_browser_store,myth_v23_cleanup;
revoke all on all functions in schema v23_private from myth_v23_executor,myth_v23_foundation;
revoke all on ops.v23_profile_runtime_records,ops.v23_profile_runtime_quota
  from myth_v23_executor,myth_v23_foundation,myth_v23_cleanup;
revoke execute on function consumer.save_entity(uuid,text,jsonb),
  consumer.add_saved_entity_to_project(uuid,uuid,text),
  ops.consume_consumer_auth_handoff(text,text,text,text,text,text,text)
  from myth_v23_foundation;
revoke select on network.network_entities,network.network_entity_bindings,
  network.network_entity_redirects from myth_v23_foundation;
-- Separately revoke run-approved login memberships from the exact named logins
-- recorded at setup. No guessed login, DROP OWNED, CASCADE, or research deletion.
commit;
