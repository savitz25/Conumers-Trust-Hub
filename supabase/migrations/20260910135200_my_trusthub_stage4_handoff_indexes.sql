-- Cover the new handoff foreign keys for parent deletion/binding governance.
create index consumer_save_handoffs_user_idx on ops.consumer_save_handoffs(canonical_user_id);
create index consumer_save_handoffs_binding_idx on ops.consumer_save_handoffs(binding_id);
