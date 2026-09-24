import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConnectionConfig, RUNTIME_POOL_MAX } from './database-config.ts';
import { ISOLATED_PROJECT, PARENT_LOGIN } from './isolated-config.ts';
const ca='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
const base={MY_TRUSTHUB_V23_DATABASE_CA_PEM:ca};
test('direct and exact Supavisor session configurations are accepted',()=>{
  assert.equal(databaseConnectionConfig({...base,MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE:'DIRECT',MY_TRUSTHUB_V23_PARENT_DATABASE_URL:`postgres://${PARENT_LOGIN}:secret@db.${ISOLATED_PROJECT}.supabase.co:5432/postgres`})?.mode,'DIRECT');
  const host='aws-0-us-east-1.pooler.supabase.com';
  assert.equal(databaseConnectionConfig({...base,MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE:'SUPAVISOR_SESSION',MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST:host,MY_TRUSTHUB_V23_PARENT_DATABASE_URL:`postgres://${PARENT_LOGIN}.${ISOLATED_PROJECT}:secret@${host}:5432/postgres`})?.mode,'SUPAVISOR_SESSION');
  assert.equal(RUNTIME_POOL_MAX,2);
});
test('transaction pooler, wrong identity, host, project and implicit mode fail closed',()=>{
  const host='aws-0-us-east-1.pooler.supabase.com';
  const make=(url:string,extra={})=>databaseConnectionConfig({...base,MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE:'SUPAVISOR_SESSION',MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST:host,MY_TRUSTHUB_V23_PARENT_DATABASE_URL:url,...extra});
  for(const url of [
    `postgres://${PARENT_LOGIN}.${ISOLATED_PROJECT}:secret@${host}:6543/postgres`,
    `postgres://${PARENT_LOGIN}.qvvxvbcdmbjzrgvwjatw:secret@${host}:5432/postgres`,
    `postgres://${PARENT_LOGIN}.${ISOLATED_PROJECT}:secret@evil.example:5432/postgres`,
    `postgres://postgres.${ISOLATED_PROJECT}:secret@${host}:5432/postgres`,
    `postgres://${PARENT_LOGIN}.${ISOLATED_PROJECT}:secret@${host}:5432/postgres?pgbouncer=true`,
  ]) assert.equal(make(url),null);
  assert.equal(databaseConnectionConfig({...base,MY_TRUSTHUB_V23_PARENT_DATABASE_URL:`postgres://${PARENT_LOGIN}:secret@db.${ISOLATED_PROJECT}.supabase.co:5432/postgres`}),null);
});
