-- UNAPPLIED; exact proposal reversal only. Confirm role/object provenance first.
begin;
drop policy v23_receipt_consumer on ops.v23_profile_runtime_records;
revoke select,insert,update on ops.v23_profile_runtime_records from myth_v23_receipt_consumer;
revoke execute on function consumer.add_saved_entity_to_project(uuid,uuid,text) from myth_v23_receipt_consumer;
revoke execute on function consumer.save_entity(uuid,text,jsonb) from myth_v23_receipt_consumer;
revoke execute on function consumer.require_user() from myth_v23_receipt_consumer;
revoke execute on function auth.uid() from myth_v23_receipt_consumer;
revoke usage on schema consumer,ops,auth from myth_v23_receipt_consumer;
drop role myth_v23_receipt_consumer;
-- No CASCADE, no table/receipt/research deletion, no broad rollback snapshot.
commit;
