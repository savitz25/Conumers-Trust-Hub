import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const sql=readFileSync('supabase/migrations/20260919205200_my_trusthub_v23_transaction_capability.sql','utf8').toLowerCase();
const wrappers=['save_profile(uuid)','add_project(uuid,uuid)','consume_context(jsonb)'];
test('hosted owner transfer retains non-login, non-inheriting, non-bypass foundation',()=>{
  assert.match(sql,/create role myth_v23_foundation nologin noinherit nosuperuser nobypassrls;/);
  for(const signature of wrappers){
    assert.ok(sql.includes(`alter function v23_private.${signature} owner to myth_v23_foundation;`));
    assert.ok(sql.includes(`revoke all on function v23_private.${signature} from public;`));
    assert.ok(sql.includes(`grant execute on function v23_private.${signature} to myth_v23_executor;`));
    const name=signature.split('(')[0];
    const body=sql.slice(sql.indexOf(`create function v23_private.${name}(`),sql.indexOf(`alter function v23_private.${signature}`));
    assert.match(body,/security definer set search_path=pg_catalog,/);
  }
});
test('temporary capabilities bracket all owner transfers and are removed before commit',()=>{
  const grantCreate=sql.indexOf('grant create on schema v23_private to myth_v23_foundation;');
  const grantSet=sql.indexOf('grant myth_v23_foundation to current_user with admin false, inherit false, set true granted by current_user;');
  const revokeCreate=sql.indexOf('revoke create on schema v23_private from myth_v23_foundation;');
  const revokeSet=sql.indexOf('revoke myth_v23_foundation from current_user granted by current_user;');
  assert.ok(grantCreate>0 && grantSet>grantCreate);
  for(const signature of wrappers){
    const transfer=sql.indexOf(`alter function v23_private.${signature} owner to myth_v23_foundation;`);
    assert.ok(transfer>grantSet && transfer<revokeCreate);
  }
  assert.ok(revokeSet>revokeCreate && revokeSet<sql.lastIndexOf('commit;'));
  assert.equal((sql.match(/grant myth_v23_foundation to current_user /g)||[]).length,1);
  assert.equal((sql.match(/grant create on schema v23_private /g)||[]).length,1);
  assert.doesNotMatch(sql,/with[^;]*(?:inherit true|admin true)/);
  assert.doesNotMatch(sql,/revoke myth_v23_foundation from current_user;/);
  assert.doesNotMatch(sql,/no role memberships:/);
});
test('post-apply assertions check effective SET/INHERIT and exact wrapper ACLs',()=>{
  const checks=readFileSync('supabase/tests/v23_hosted_security_assertions.sql','utf8');
  for(const check of ["'SET'","'USAGE'","'CREATE'",'grantor=current_user::regrole','prosecdef','aclexplode','relforcerowsecurity'])assert.ok(checks.includes(check));
});
