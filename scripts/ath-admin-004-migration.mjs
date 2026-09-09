import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const TABLES=['ath_ops_cases','ath_claim_policy_evaluations','ath_ops_case_events'];
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase();
const url=process.env.ATH_ADMIN_004_DATABASE_URL;
if(!url)throw new Error('ATH_ADMIN_004_DATABASE_URL is required');
const mode=process.argv[2]??'post', client=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,statement_timeout:30000});
await client.connect();
try{
  const identity=(await client.query(`SELECT current_database() database,current_setting('server_version') version,current_setting('neon.project_id',true) project_id,current_setting('neon.branch_id',true) branch_id`)).rows[0];
  const migrationHash=sha('schema/migrations/014_ath_claim_operations.sql'), rollbackHash=sha('schema/migrations/014_ath_claim_operations.down.sql');
  if(identity.project_id!=='hidden-glitter-26313488'||identity.database!=='neondb')throw new Error('Refusing unexpected database target');
  if(mode==='apply'){
    const existing=(await client.query(`SELECT count(*)::int n FROM pg_class WHERE relname=ANY($1::text[])`,[TABLES])).rows[0].n;
    if(existing)throw new Error('Migration 014 objects already present');
    await client.query('BEGIN');
    try{await client.query(`SELECT pg_advisory_xact_lock(hashtext('ath-admin-004-migration-014'))`);await client.query(readFileSync('schema/migrations/014_ath_claim_operations.sql','utf8'));await client.query('COMMIT')}catch(error){await client.query('ROLLBACK');throw error}
  }
  const tables=await client.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1::text[]) ORDER BY relname`,[TABLES]);
  const policies=await client.query(`SELECT tablename,policyname FROM pg_policies WHERE tablename=ANY($1::text[]) ORDER BY tablename` ,[TABLES]);
  const constraints=await client.query(`SELECT conrelid::regclass::text table_name,conname,contype FROM pg_constraint WHERE conrelid=ANY($1::regclass[]) ORDER BY 1,2`,[TABLES]);
  const triggers=await client.query(`SELECT event_object_table table_name,trigger_name,event_manipulation FROM information_schema.triggers WHERE event_object_table=ANY($1::text[]) ORDER BY 1,2`,[TABLES]);
  const grants=await client.query(`SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_name=ANY($1::text[]) AND grantee IN('PUBLIC','anon','authenticated')`,[TABLES]);
  const counts=await client.query(`SELECT (SELECT count(*)::int FROM ath_users) users,(SELECT count(*)::int FROM ath_sessions) sessions,(SELECT count(*)::int FROM ath_claims) claims,(SELECT count(*)::int FROM ath_management_grants) grants`);
  console.log(JSON.stringify({mode,identity,migrationHash,rollbackHash,tables:tables.rows,policies:policies.rows,constraints:constraints.rows,triggers:triggers.rows,publicGrants:grants.rows,authoritativeCounts:counts.rows[0]},null,2));
}finally{await client.end()}
