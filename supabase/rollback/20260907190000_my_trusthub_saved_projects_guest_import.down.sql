-- P12-only compensating rollback. P11 network/consumer/ops foundation remains.

begin;

drop function if exists consumer.list_projects();
drop function if exists consumer.list_saved_entities();
drop function if exists consumer.commit_guest_import(jsonb, text[], uuid, uuid);
drop function if exists consumer.preview_guest_import(jsonb);
drop function if exists consumer.validate_guest_payload(jsonb);
drop function if exists consumer.delete_note(uuid);
drop function if exists consumer.update_note(uuid, bigint, text, text);
drop function if exists consumer.create_note(uuid, uuid, uuid, text, text);
drop function if exists consumer.remove_saved_entity_from_project(uuid, uuid);
drop function if exists consumer.add_saved_entity_to_project(uuid, uuid, text);
drop function if exists consumer.restore_project(uuid, bigint);
drop function if exists consumer.archive_project(uuid, bigint);
drop function if exists consumer.update_project(uuid, bigint, text, jsonb, date);
drop function if exists consumer.create_project(uuid, text, text, jsonb, date);
drop function if exists consumer.remove_saved_entity(uuid, bigint);
drop function if exists consumer.save_entity(uuid, text, jsonb);

drop table if exists consumer.consumer_guest_import_items;
drop table if exists consumer.consumer_guest_imports;
drop table if exists consumer.consumer_notes;
drop table if exists consumer.consumer_project_saved_entities;
drop table if exists consumer.consumer_projects;
drop table if exists consumer.consumer_saved_entities;

drop function if exists consumer.enforce_note_ownership();
drop function if exists consumer.enforce_membership_ownership();
drop function if exists consumer.valid_location_context(jsonb);
drop function if exists consumer.require_user();

commit;
