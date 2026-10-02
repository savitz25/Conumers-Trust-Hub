-- MY TRUSTHUB V2 PRODUCTION HANDOFF — SESSION MAC KEY INSTALL.
-- Target qvvxvbcdmbjzrgvwjatw. ONE persistent operator session; approval GUC,
-- the hidden MAC parameter and this SQL must stay in that session.
-- Before this file, in the same session and through a parameterized,
-- non-echoing trusted runner (never pasted into a transcript):
--   select set_config('v23.approved_project','qvvxvbcdmbjzrgvwjatw',false);
--   select set_config('v23.install_session_mac','<64 hex>',false);
-- The hex is sha256 of the PRODUCTION MY_TRUSTHUB_V23_ASK_SIGNING_PRIVATE_KEY_PEM
-- (UTF-8, no trailing newline added). scripts/release/mth-v2-prod-secrets.mjs
-- writes it to a local secure file for exactly this step. A different key fails
-- closed instead of replacing an installed key.
begin;
do $$ begin
  if current_setting('v23.approved_project', true) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Explicit production apply authorization required';
  end if;
  if (select project_ref from v23_private.prod_deployment_pin where singleton) is distinct from 'qvvxvbcdmbjzrgvwjatw' then
    raise exception 'Deployment pin is not the production Ask project';
  end if;
  if not coalesce(current_setting('v23.install_session_mac', true) ~ '^[0-9a-f]{64}$',false) then
    raise exception 'v23.install_session_mac must be the 64-hex sha256 of the production Ask signing private key PEM';
  end if;
end $$;
grant myth_v23_foundation to current_user with admin false,inherit false,set true granted by current_user;
set local role myth_v23_foundation;
select v23_private.prod_session_install_mac(decode(current_setting('v23.install_session_mac'),'hex'));
reset role;
revoke myth_v23_foundation from current_user granted by current_user;
select set_config('v23.install_session_mac','',false);
do $$ begin
  if not exists(select 1 from v23_private.prod_session_mac where singleton and octet_length(key)=32) then
    raise exception 'V23_PROD_SESSION_MAC_FAIL';
  end if;
  raise notice 'V23_PROD_SESSION_MAC_INSTALLED';
end $$;
commit;
