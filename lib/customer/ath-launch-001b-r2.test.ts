import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { selectAskDatabaseUrl } from './database-selection.ts';
import { assertR2FixtureEnvironment, cleanupR2Fixture, createR2Fixture, R2_FIXTURE, R2_FIXTURE_BRANCH, R2_FIXTURE_CONFIRMATION, verifyR2Fixture } from './browser-fixture.ts';
import { resendMailer } from './mail.ts';
import type { SqlClient } from './sql.ts';

const safeEnv={NODE_ENV:'production',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:R2_FIXTURE_BRANCH,ATH_FIXTURE_ENV:'preview',ATH_ALLOW_SYNTHETIC_FIXTURE:'1',ATH_PREVIEW_DB_DATABASE_URL:'postgres://fixture.invalid/fixture',neon_tech_database:'postgres://production.invalid/production'};

test('preview database selection is explicit and production never selects fixture storage',()=>{
  assert.equal(selectAskDatabaseUrl(safeEnv),'postgres://fixture.invalid/fixture');
  assert.equal(selectAskDatabaseUrl({...safeEnv,VERCEL_ENV:'production'}),'postgres://production.invalid/production');
  assert.equal(selectAskDatabaseUrl({...safeEnv,ATH_ALLOW_SYNTHETIC_FIXTURE:'0'}),'postgres://production.invalid/production');
});

test('fixture guard refuses production, wrong branch, missing confirmation, and shared database',()=>{
  assert.doesNotThrow(()=>assertR2FixtureEnvironment(safeEnv,R2_FIXTURE_CONFIRMATION));
  for(const env of [{...safeEnv,VERCEL_ENV:'production'},{...safeEnv,VERCEL_GIT_COMMIT_REF:'main'},{...safeEnv,ATH_ALLOW_SYNTHETIC_FIXTURE:'0'},{...safeEnv,ATH_PREVIEW_DB_DATABASE_URL:safeEnv.neon_tech_database}]) assert.throws(()=>assertR2FixtureEnvironment(env,R2_FIXTURE_CONFIRMATION));
  assert.throws(()=>assertR2FixtureEnvironment(safeEnv,'wrong'));
});

test('fixture identities are synthetic and never require a public specialist profile',()=>{
  assert.match(R2_FIXTURE.ownerEmail,/@ath-browser-fixture\.test$/);
  assert.match(R2_FIXTURE.emptyEmail,/@ath-browser-fixture\.test$/);
  assert.equal(new Set(Object.values(R2_FIXTURE.profiles)).size,8);
});

test('fixture creation is idempotent, covers launch states, and cleanup is exact',async()=>{
  const db=new PGlite();
  const sql:SqlClient={async query(text,params){const result=await db.query(text,params??[]);return{rows:(result.rows??[]) as Record<string,unknown>[]}},async exec(text){await db.exec(text)}};
  await applyCustomerMigrations(sql);await db.query('BEGIN');await enableAppRole(sql);
  await createR2Fixture(sql);const first=await verifyR2Fixture(sql);await createR2Fixture(sql);const second=await verifyR2Fixture(sql);
  assert.deepEqual(second,first);assert.deepEqual(first,{users:4,organizations:3,profiles:7,claims:7,grants:5,monitoring:2,issues:1,invitations:1});
  const states=(await sql.query<{status:string}>(`SELECT status FROM ath_claims WHERE id::text LIKE 'a2800000-%' ORDER BY status`)).rows.map(r=>r.status);assert.deepEqual(states,['in_review','needs_info']);
  const monitoring=(await sql.query<{enabled:boolean}>(`SELECT enabled FROM ath_monitoring_subscriptions WHERE id::text LIKE 'a2900000-%' ORDER BY enabled`)).rows;assert.deepEqual(monitoring.map(r=>r.enabled),[false,true]);
  assert.equal((await sql.query(`SELECT 1 FROM ath_notifications WHERE id='a2b00000-0000-4000-8000-000000000001' AND read_at IS NULL`)).rows.length,1);
  assert.equal((await sql.query(`SELECT 1 FROM ath_business_replies WHERE id='a2d00000-0000-4000-8000-000000000001' AND status='DRAFT'`)).rows.length,1);
  await sql.query(`INSERT INTO ath_audit_events(actor_user_id,org_id,object_type,object_id,action) VALUES($1,$2,'ath_users',$1,'login_confirmed')`,[R2_FIXTURE.users.owner,R2_FIXTURE.organizations.harbor]);
  await cleanupR2Fixture(sql);await cleanupR2Fixture(sql);assert.deepEqual(await verifyR2Fixture(sql),{users:0,organizations:0,profiles:0,claims:0,grants:0,monitoring:0,issues:0,invitations:0});
  assert.equal((await sql.query(`SELECT 1 FROM ath_audit_events WHERE object_id::text LIKE 'a2100000-%'`)).rows.length,0);
  await db.query('ROLLBACK');await db.close();
});

test('fixture preview mail sink suppresses outbound delivery',async()=>{
  const prior={NODE_ENV:process.env.NODE_ENV,VERCEL_ENV:process.env.VERCEL_ENV,ATH_FIXTURE_ENV:process.env.ATH_FIXTURE_ENV,ATH_ALLOW_SYNTHETIC_FIXTURE:process.env.ATH_ALLOW_SYNTHETIC_FIXTURE,RESEND_API_KEY:process.env.RESEND_API_KEY};
  Object.assign(process.env,{NODE_ENV:'production',VERCEL_ENV:'preview',ATH_FIXTURE_ENV:'preview',ATH_ALLOW_SYNTHETIC_FIXTURE:'1',RESEND_API_KEY:'must-not-be-used'});
  try{const result=await resendMailer({to:R2_FIXTURE.ownerEmail,subject:'fixture',html:'fixture',text:'fixture'});assert.deepEqual(result,{sent:false,preview:'fixture'});}
  finally{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
