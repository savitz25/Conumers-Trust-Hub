import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const EXPECTED_MIGRATION_HASH = '3DF38C16B37B1772DD8E675358A2411474EE94FD385747A3A410BC22514308DB';
const EXPECTED_ROLLBACK_HASH = 'EC751CAC9CE609F323A86BF67FDBDB102EDEF93910E41D0ABE13C562564F7F77';
const REQUIRED_PRE_011 = [
  'ath_users','ath_sessions','ath_claims','ath_management_grants','ath_organizations','ath_memberships',
  'ath_review_queue','ath_business_profile_fields','ath_record_issues','ath_business_replies',
  'ath_regulatory_change_events','ath_monitoring_subscriptions','ath_organization_invitations','ath_hub_profiles',
];
const ADMIN_TABLES = ['ath_admin_staff','ath_admin_audit_log','ath_admin_commands','ath_control_flags','ath_admin_break_glass_requests'];

function sha(path){return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()}
function requireUrl(){const raw=process.env.neon_tech_database||process.env.ASK_DATABASE_URL;if(!raw||raw==='[SENSITIVE]')throw new Error('Production Ask database credential is unavailable');return new URL(raw)}
function safeIdentity(url){return{provider:/neon\.tech$/i.test(url.hostname)||/neon/i.test(url.hostname)?'Neon Postgres':'UNKNOWN',host_fingerprint:createHash('sha256').update(url.hostname).digest('hex').slice(0,16),pooled:url.hostname.includes('-pooler'),database:url.pathname.slice(1)||null}}
async function snapshot(client){
  const names=[...REQUIRED_PRE_011,...ADMIN_TABLES];
  const tables=await client.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind='r' AND c.relname=ANY($1::text[]) ORDER BY c.relname`,[names]);
  const found=new Set(tables.rows.map(r=>r.relname));
  const missingRequired=REQUIRED_PRE_011.filter(x=>!found.has(x));
  const adminPresent=ADMIN_TABLES.filter(x=>found.has(x));
  const counts={};for(const name of REQUIRED_PRE_011.filter(x=>found.has(x))){const q=await client.query(`SELECT count(*)::text AS count FROM ${pg.escapeIdentifier(name)}`);counts[name]=q.rows[0].count}
  const health=await client.query(`SELECT current_database() database, current_setting('server_version') version, now() checked_at, (SELECT count(*)::text FROM pg_stat_activity WHERE state<>'idle' AND pid<>pg_backend_pid() AND query_start<now()-interval '5 minutes') long_running, (SELECT count(*)::text FROM pg_locks WHERE NOT granted) blocked_locks`);
  return{health:health.rows[0],missingRequired,adminPresent,counts,tables:tables.rows};
}
async function main(){
  const mode=process.argv[2]||'preflight',url=requireUrl(),identity=safeIdentity(url);
  const migrationHash=sha('schema/migrations/011_ath_admin_security_foundation.sql'),rollbackHash=sha('schema/migrations/011_ath_admin_security_foundation.down.sql');
  if(migrationHash!==EXPECTED_MIGRATION_HASH||rollbackHash!==EXPECTED_ROLLBACK_HASH)throw new Error('Validated migration checksum mismatch');
  const client=new pg.Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,statement_timeout:30000});
  await client.connect();
  try{
    if(mode==='admin-state'){
      await client.query(`SELECT set_config('ath.app_role','server',false)`);
      const state=await client.query(`SELECT
        (SELECT count(*)::int FROM ath_users) users,
        (SELECT count(*)::int FROM ath_sessions) sessions,
        (SELECT count(*)::int FROM ath_admin_staff) staff,
        (SELECT count(*)::int FROM ath_admin_staff WHERE role='SUPER_ADMIN' AND status='ACTIVE') active_super_admin,
        (SELECT count(*)::int FROM ath_admin_audit_log) audit_rows,
        (SELECT count(*)::int FROM ath_admin_audit_log WHERE event_type='ADMIN_BOOTSTRAPPED') bootstrap_audits,
        (SELECT count(*)::int FROM ath_control_flags) flags,
        (SELECT count(*)::int FROM ath_admin_commands) commands`);
      console.log(JSON.stringify({identity,state:state.rows[0]},null,2));return
    }
    if(mode==='preflight'){console.log(JSON.stringify({identity,migrationHash,rollbackHash,...await snapshot(client)},null,2));return}
    if(mode==='post'){
      const constraints=await client.query(`SELECT conrelid::regclass::text AS table_name,conname,contype,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid=ANY($1::regclass[]) ORDER BY 1,2`,[ADMIN_TABLES]);
      const indexes=await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename=ANY($1::text[]) ORDER BY 1,2`,[ADMIN_TABLES]);
      const triggers=await client.query(`SELECT event_object_table AS table_name,trigger_name,event_manipulation,action_statement FROM information_schema.triggers WHERE event_object_table=ANY($1::text[]) ORDER BY 1,2,3`,[ADMIN_TABLES]);
      const policies=await client.query(`SELECT tablename,policyname,roles,qual,with_check FROM pg_policies WHERE schemaname=current_schema() AND tablename=ANY($1::text[]) ORDER BY 1,2`,[ADMIN_TABLES]);
      const grants=await client.query(`SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) AND grantee IN('PUBLIC','anon','authenticated') ORDER BY 1,2,3`,[ADMIN_TABLES]);
      await client.query('BEGIN');let ordinaryCount,serverCount;try{await client.query(`SELECT set_config('ath.app_role','',true)`);ordinaryCount=(await client.query(`SELECT count(*)::text count FROM ath_admin_staff`)).rows[0].count;await client.query(`SELECT set_config('ath.app_role','server',true)`);serverCount=(await client.query(`SELECT count(*)::text count FROM ath_admin_staff`)).rows[0].count}finally{await client.query('ROLLBACK')}
      console.log(JSON.stringify({identity,migrationHash,rollbackHash,snapshot:await snapshot(client),constraints:constraints.rows,indexes:indexes.rows,triggers:triggers.rows,policies:policies.rows,publicGrants:grants.rows,rlsProof:{ordinaryVisibleRows:ordinaryCount,serverVisibleRows:serverCount}},null,2));return
    }
    if(mode!=='apply')throw new Error('Mode must be admin-state, preflight, post, or apply');
    if(identity.provider!=='Neon Postgres'||identity.database!=='neondb')throw new Error('Refusing unexpected production target');
    if(identity.pooled)throw new Error('Refusing schema migration over pooled endpoint; use a direct Neon connection');
    const before=await snapshot(client);if(before.missingRequired.length||before.adminPresent.length)throw new Error('Pre-migration schema gate failed');
    const sql=readFileSync('schema/migrations/011_ath_admin_security_foundation.sql','utf8'),startedAt=new Date().toISOString();
    await client.query('BEGIN');
    try{await client.query(`SELECT pg_advisory_xact_lock(hashtext('ath-admin-002b-migration-011'))`);await client.query(sql);await client.query('COMMIT')}catch(error){await client.query('ROLLBACK');throw error}
    console.log(JSON.stringify({identity,migrationHash,startedAt,finishedAt:new Date().toISOString(),result:'COMMITTED',post:await snapshot(client)},null,2));
  }finally{await client.end()}
}
main().catch(error=>{console.error(JSON.stringify({error:error instanceof Error?error.message:'Unknown activation error'}));process.exitCode=1});
