import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';

const mode=process.argv[2];
if(!['migrate','migrate-013','preflight','proof','contract-proof','health','explain'].includes(mode)){console.error('usage: node scripts/ath-admin-003-production.mjs <migrate|migrate-013|preflight|proof|contract-proof|health|explain>');process.exit(2)}
const connectionString=process.env.ASK_DATABASE_URL;
if(!connectionString)throw new Error('ASK_DATABASE_URL is required');
const client=new pg.Client({connectionString,ssl:{rejectUnauthorized:false}});
await client.connect();
try{
  if(mode==='migrate'||mode==='migrate-013'){
    const file=mode==='migrate'?'012_ath_product_events.sql':'013_ath_product_event_id_contract.sql';
    const sql=await fs.readFile(new URL(`../schema/migrations/${file}`,import.meta.url),'utf8');
    const checksum=crypto.createHash('sha256').update(sql).digest('hex').toUpperCase();
    const startedAt=new Date().toISOString();
    await client.query('BEGIN');
    try{await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`ath-admin-003-${file}`]);await client.query(sql);await client.query('COMMIT')}
    catch(error){await client.query('ROLLBACK');throw error}
    console.log(JSON.stringify({ok:true,mode,checksum,startedAt,finishedAt:new Date().toISOString(),result:'COMMITTED'}));
  }else if(mode==='preflight'){
    const r=(await client.query(`SELECT to_regclass('public.ath_product_events') IS NOT NULL product_events_exists,to_regclass('public.ath_admin_staff') IS NOT NULL admin_exists,(SELECT count(*)::int FROM ath_users) users,(SELECT count(*)::int FROM ath_sessions) sessions,(SELECT count(*)::int FROM ath_admin_staff WHERE status='ACTIVE') active_staff`)).rows[0];console.log(JSON.stringify({ok:Boolean(r.admin_exists&&!r.product_events_exists),mode,...r}));
  }else if(mode==='proof'){
    await client.query('BEGIN');await client.query("SELECT set_config('ath.app_role','server',true)");
    const table=(await client.query(`SELECT c.relrowsecurity,c.relforcerowsecurity FROM pg_class c WHERE c.relname='ath_product_events'`)).rows[0];
    const indexes=(await client.query(`SELECT indexname FROM pg_indexes WHERE tablename='ath_product_events' ORDER BY indexname`)).rows.map(r=>r.indexname);
    const policies=(await client.query(`SELECT policyname FROM pg_policies WHERE tablename='ath_product_events' ORDER BY policyname`)).rows.map(r=>r.policyname);
    const grants=(await client.query(`SELECT count(*)::int n FROM information_schema.role_table_grants WHERE table_name='ath_product_events' AND grantee IN('PUBLIC','anon','authenticated')`)).rows[0].n;
    const epoch=(await client.query(`SELECT count(*)::int n FROM ath_product_events WHERE event_name='telemetry_store_activated'`)).rows[0].n;
    await client.query('ROLLBACK');console.log(JSON.stringify({ok:Boolean(table?.relrowsecurity&&table?.relforcerowsecurity&&policies.includes('ath_server_all')&&grants===0&&epoch===1),mode,rls:Boolean(table?.relrowsecurity),forceRls:Boolean(table?.relforcerowsecurity),policies,indexes,publicGrantCount:grants,activationEpochCount:epoch}));
  }else if(mode==='contract-proof'){
    await client.query('BEGIN');
    try {
      await client.query("SELECT set_config('ath.app_role','server',true)");
      await client.query(`INSERT INTO ath_product_events(event_id,schema_version,event_name,occurred_at,surface,hub,route_family,terminal_outcome,created_at) VALUES ('evt_1','product_event.v1','search_terminal_outcome',now(),'search','ask','/ask','RESULTS',now())`);
      const count=(await client.query(`SELECT count(*)::int n FROM ath_product_events WHERE event_id='evt_1'`)).rows[0].n;
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ok:count===1,mode,boundedStringEventIdPersisted:count===1,transaction:'ROLLED_BACK'}));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }else if(mode==='health'){
    const r=(await client.query(`SELECT current_database() database,current_setting('server_version') version,current_setting('neon.project_id',true) project_id,current_setting('neon.branch_id',true) branch_id,(SELECT count(*)::int FROM ath_users) users,(SELECT count(*)::int FROM ath_sessions) sessions,(SELECT count(*)::int FROM ath_admin_staff WHERE status='ACTIVE') active_staff,(SELECT count(*)::int FROM pg_locks WHERE NOT granted) blocked_locks`)).rows[0];console.log(JSON.stringify({ok:true,mode,...r}));
  }else{
    await client.query('BEGIN');await client.query("SELECT set_config('ath.app_role','server',true)");
    const plan=(await client.query(`EXPLAIN (FORMAT JSON) SELECT terminal_outcome,count(*) FROM ath_product_events WHERE event_name='search_terminal_outcome' AND occurred_at>=now()-interval '7 days' GROUP BY terminal_outcome`)).rows[0]['QUERY PLAN'];await client.query('ROLLBACK');console.log(JSON.stringify({ok:true,mode,plan}));
  }
}finally{await client.end()}
