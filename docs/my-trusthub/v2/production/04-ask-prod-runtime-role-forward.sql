-- MY TRUSTHUB V2 PRODUCTION HANDOFF — ASK RUNTIME LOGIN.
-- Target qvvxvbcdmbjzrgvwjatw. Operator session only. Separate authorization.
-- No password is generated, embedded or logged here. After COMMIT, set the
-- password through a non-echoing channel in the SAME operator session, e.g.
-- psql: \password myth_v23_parent_prod
-- The value goes only into the Vercel secret MY_TRUSTHUB_V23_PARENT_DATABASE_URL
-- for the Ask production project (Supavisor session URI, port 5432, user
-- myth_v23_parent_prod.qvvxvbcdmbjzrgvwjatw, database postgres).
begin;
do $$ begin
 if current_setting('v23.approved_project',true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
   raise exception 'Explicit production runtime-login authorization required'; end if;
 if not exists(select 1 from v23_private.prod_deployment_pin where project_ref='qvvxvbcdmbjzrgvwjatw') then
   raise exception 'Reviewed production ports (02) required'; end if;
end $$;
create role myth_v23_parent_prod login noinherit nosuperuser nobypassrls
 nocreatedb nocreaterole noreplication connection limit 6 password null;
grant myth_v23_authorizer,myth_v23_executor to myth_v23_parent_prod
 with admin false,inherit false,set true;
alter role myth_v23_parent_prod set statement_timeout='5s';
alter role myth_v23_parent_prod set lock_timeout='3s';
alter role myth_v23_parent_prod set idle_in_transaction_session_timeout='10s';
commit;
