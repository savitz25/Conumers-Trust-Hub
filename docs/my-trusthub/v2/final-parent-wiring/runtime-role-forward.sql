-- PREPARED ONLY. Separate founder authorization; exact isolated host must be
-- checked by the runner. No password is generated, embedded, logged or applied.
begin;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'xkkiicsassizmakcvxml' then
   raise exception 'Explicit isolated runtime-login authorization required'; end if;
 if not exists(select 1 from v23_private.preview_deployment_pin where project_ref='xkkiicsassizmakcvxml') then
   raise exception 'Reviewed private ports required'; end if;
end $$;
create role myth_v23_parent_preview login noinherit nosuperuser nobypassrls
 nocreatedb nocreaterole noreplication connection limit 6 password null;
grant myth_v23_authorizer,myth_v23_executor to myth_v23_parent_preview
 with admin false,inherit false,set true;
alter role myth_v23_parent_preview set statement_timeout='5s';
alter role myth_v23_parent_preview set lock_timeout='3s';
alter role myth_v23_parent_preview set idle_in_transaction_session_timeout='10s';
commit;
-- After authorization, set password through a secure local interactive channel
-- (e.g. psql \password myth_v23_parent_preview). Never put its value in this file.
