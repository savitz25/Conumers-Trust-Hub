// Static source validation ONLY. Does not import a DB driver or execute SQL.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const sql=readFileSync(new URL('../../docs/my-trusthub/v2/V2-3BIND-isolated-create.sql',import.meta.url),'utf8');
test('approved binding script remains inert and transaction-bounded',()=>{
  assert.ok(sql.indexOf("raise exception 'V2-3BIND: isolated environment")<sql.indexOf('insert into network.network_entities'));
  assert.match(sql,/begin isolation level serializable;/);
  assert.match(sql,/set local role myth_identity_governor;/);
  assert.match(sql,/transaction_timestamp\(\),null/);
  assert.match(sql,/with new_entity as/);
  assert.match(sql,/commit;/);
  assert.doesNotMatch(sql,/\b(?:update|delete from|create role|alter table)\s+network\./i);
});
test('canonical organization and specialist mover stay distinct',()=>{
  assert.match(sql,/'organization','HINDMAN & ISAACS MOVING & STORAGE INC','move','US'/);
  assert.match(sql,/'move','mover','usdot-1002530','fmcsa.usdot','1002530','US','accepted',null/);
  assert.match(sql,/Historical ingestion row hash\/version unavailable/);
  assert.match(sql,/source_identifier_normalized/);
  assert.match(sql,/network\.network_entity_redirects/);
  assert.match(sql,/interval '2 minutes'/);
  assert.doesNotMatch(sql,/insert into (?:consumer|auth|ops)\./i);
});
