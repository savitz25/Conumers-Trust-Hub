// Isolated PostgreSQL only; never connects to production or fetches public data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite({extensions:{pgcrypto,btree_gist}});const results=[];
const check=(name,pass)=>{results.push({name,pass});assert(pass,name);};
const query=async(sql,args)=>(await db.query(sql,args)).rows;
const denied=async(name,sql,args)=>{let failed=false;try{await db.query(sql,args);}catch{failed=true;}check(name,failed);};
const sandbox=async(fn)=>{await db.exec('begin;');try{await fn();}finally{await db.exec('rollback;');}};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz,raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to public;grant execute on function auth.uid()to public;`);
 for(const f of fs.readdirSync(root+'supabase/migrations').sort().filter(f=>f.endsWith('.sql')))await db.exec(fs.readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec(fs.readFileSync(root+'supabase/seeds/p14_watch_capabilities_validation.sql','utf8'));
 await db.exec(fs.readFileSync(root+'supabase/seeds/p15_monitoring_validation.sql','utf8'));
 let fixture=fs.readFileSync(root+'supabase/tests/p15_source_observations.sql','utf8').split('-- Healthy baseline run.')[0].replaceAll('P15-LIC-1','CCC1332036').replaceAll('P15-LIC-2','CRC1332036');
 await db.exec(fixture);await db.exec('commit;reset role;grant myth_p15_dbpr_runtime to postgres;');
 const v1=(await query("select id from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=1"))[0].id;
 const v2=(await query("select id from network.watch_capabilities where capability_key='contractor.fl.dbpr.license_status' and version=2"))[0].id;
 const watches=await query('select w.id,w.user_id,w.row_version,w.saved_entity_id from consumer.consumer_watches w join consumer.consumer_watch_coverage c on c.watch_id=w.id where c.capability_id=$1 and c.status=\'enabled\' order by w.id',[v1]);
 check('v2 registration creates no automatic coverage',(await query('select count(*)::int n from consumer.consumer_watch_coverage where capability_id=$1',[v2]))[0].n===0);
 check('original v1 coverage remains enabled',watches.length===2);
 await denied('v1 contract remains immutable',"update network.watch_capability_observation_contracts set material_field_keys=array['primary_status'] where capability_id=$1",[v1]);
 await denied('v2 source and clock semantics are immutable',"update network.watch_capability_observation_contracts set source_contract='{}' where capability_id=$1",[v2]);
 const upgradeSql='select consumer.upgrade_dbpr_watch($1,$2,$3,$4,$5,$6) version';
 const consent='dbpr-exact-lookup-v2/2026-09-10';
 await db.exec('set role authenticated;');
 await query("select set_config('request.jwt.claim.sub',$1,false)",['12000000-0000-4000-8000-000000000002']);
 await denied('Consumer B cannot upgrade founder Watch',upgradeSql,[watches[0].id,v1,v2,watches[0].row_version,randomUUID(),consent]);
 await denied('Consumer B cannot read accepted private status','select * from consumer.get_dbpr_watch_status($1)',[watches[0].saved_entity_id]);
 await query("select set_config('request.jwt.claim.sub',$1,false)",[watches[0].user_id]);
 await denied('missing explicit consent is denied',upgradeSql,[watches[0].id,v1,v2,watches[0].row_version,randomUUID(),null]);
 await denied('unrecognized consent revision is denied',upgradeSql,[watches[0].id,v1,v2,watches[0].row_version,randomUUID(),'old-consent']);
 await denied('stale version consent is denied',upgradeSql,[watches[0].id,v1,v2,999,randomUUID(),consent]);
 await denied('unrelated capability cannot replace v1',upgradeSql,[watches[0].id,v1,randomUUID(),watches[0].row_version,randomUUID(),consent]);
 for(const watched of watches){
  const key=randomUUID(),args=[watched.id,v1,v2,watched.row_version,key,consent];
  await query("select set_config('request.jwt.claim.sub',$1,false)",[watched.user_id]);
  const changed=(await query(upgradeSql,args))[0].version;
  check('explicit consent atomically upgrades one Watch',Number(changed)===Number(watched.row_version)+1);
  check('same consent retry is idempotent',Number((await query(upgradeSql,args))[0].version)===Number(changed));
  await denied('consent key cannot be reused for another version',upgradeSql,[watched.id,v1,randomUUID(),watched.row_version,key,consent]);
 }
 await db.exec('reset role;');
 check('exactly one enabled v2 row per Watch',(await query("select count(*)::int n from consumer.consumer_watch_coverage where status='enabled' and capability_id=$1",[v2]))[0].n===2);
 check('v1 history is retained disabled after consent',(await query("select count(*)::int n from consumer.consumer_watch_coverage where status='disabled' and capability_id=$1 and disabled_reason='consumer_upgraded_to_version_2'",[v1]))[0].n===2);
 check('durable consent receipt captures both versions',(await query("select count(*)::int n from consumer.consumer_watch_events where metadata->>'consent_version'=$1 and metadata->>'to_version'='2'",[consent]))[0].n===2);
 await db.exec('set role myth_p15_dbpr_runtime;');
 const targets=await query('select * from ops.dbpr_v2_poll_targets()');check('scoped targets contain only selected exact v2 credentials',targets.length===2&&targets.some(t=>t.credential==='CCC1332036')&&targets.some(t=>t.credential==='CRC1332036'));
 check('upgraded Watches no longer poll the bulk v1 path',(await query('select * from ops.dbpr_poll_targets()')).length===0);
 for(const table of ['consumer.consumer_watches','consumer.consumer_saved_entities','network.source_observations','ops.source_feed_checkpoints','auth.users'])await denied('scoped runtime cannot read '+table,'select * from '+table);
 await denied('scoped runtime cannot release quarantine','select ops.release_source_quarantine($1,$2)',[v2,'test']);
 let tick=-600;
 const make=(id,primary='delinquent',secondary='active',offset)=>{
  const milliseconds=Date.now()+(offset??(tick+=10))*1000;const t=new Date(milliseconds).toISOString();
  return [id,new Date(milliseconds-1000).toISOString(),new Date(milliseconds+1000).toISOString(),JSON.stringify(targets.map((target,i)=>({credential:target.credential,primary_status:primary,secondary_status:secondary,official_status:primary[0].toUpperCase()+primary.slice(1)+','+secondary[0].toUpperCase()+secondary.slice(1),source_url:'https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID='+(i?'B':'A').repeat(32),source_as_of:null,retrieved_at:t}))),null];
 };
 const pollSql='select ops.run_dbpr_v2_poll($1,$2,$3,$4::jsonb,$5) result';
 const poll=async(args)=>(await query(pollSql,args))[0].result;
 const baselineArgs=make('baseline');const baseline=await poll(baselineArgs);
 check('undated exact lookup yields accepted baseline',baseline.checked===2&&baseline.quarantined===0&&baseline.changes===0&&baseline.health==='current');
 const repeat=await poll(baselineArgs);check('identical scheduled run is deduplicated',repeat.deduplicated===true&&repeat.checkpoint===baseline.checkpoint);
 const same=await poll(make('same'));check('same pair on next check creates no change event',same.checked===2&&same.changes===0&&same.health==='current');
 await db.exec('reset role;');
 const observations=await query('select source_as_of,retrieved_at,observed_at,sequence_effective_at,normalized_value,observation_status from network.source_observations where capability_id=$1',[v2]);
 check('source clock stays null while retrieval and observation clocks persist',observations.length===4&&observations.every(o=>o.source_as_of===null&&o.retrieved_at&&o.observed_at&&String(o.sequence_effective_at)===String(o.retrieved_at)&&o.observation_status==='accepted'));
 check('delinquent and active are separate retained material statuses',observations.every(o=>o.normalized_value.primary_status==='delinquent'&&o.normalized_value.secondary_status==='active'));
 await db.exec('set role authenticated;');await query("select set_config('request.jwt.claim.sub',$1,false)",[watches[0].user_id]);
 check('complete unchanged exact lookup permits bounded no-change statement',(await query('select * from consumer.get_watch_source_health($1)',[watches[0].saved_entity_id]))[0].no_change_eligible===true);
 await db.exec('reset role;');
 check('two missed daily checks remove current health',(await query("select ops.evaluate_checkpoint_health($1,now()+interval '3 days') health",[same.checkpoint]))[0].health==='delayed');
 await sandbox(async()=>{await db.exec('set local role myth_p15_dbpr_runtime;');const changed=await poll(make('primary-change','current','active'));check('primary status transition creates deterministic events',changed.changes===2&&changed.quarantined===0);const again=await poll(make('primary-same','current','active'));check('repeated changed status creates no duplicate event',again.changes===0);const secondary=await poll(make('secondary-change','current','inactive'));check('secondary transition is independently material',secondary.changes===2);});
 await sandbox(async()=>{await db.exec('set local role myth_p15_dbpr_runtime;');const args=make('transport-failure');args[3]='[]';args[4]='SOURCE_FETCH_FAILED';const failed=await poll(args);check('transport failure degrades previously successful source health',failed.checked===0&&failed.changes===0&&failed.health==='degraded');await db.exec('set local role authenticated;');const health=(await query('select * from consumer.get_watch_source_health($1)',[watches[0].saved_entity_id]))[0];check('failed source prevents no-change assurance',health.no_change_eligible===false&&health.health_status==='degraded');await db.exec('set local role myth_p15_dbpr_runtime;');const recovered=await poll(make('transport-recovered'));check('a compatible exact lookup recovers from transient failure',recovered.health==='current'&&recovered.quarantined===0);});
 await sandbox(async()=>{await db.exec('set local role myth_p15_dbpr_runtime;');const late=await poll(make('late','current','active',-1200));check('out-of-order lookup produces no change',late.changes===0);await db.exec('reset role;');check('out-of-order observations remain historical',(await query("select count(*)::int n from network.source_observations where ingest_run_id=$1 and observation_status='superseded' and change_evaluation_status='late_historical'",[late.checkpoint]))[0].n===2);});
 await sandbox(async()=>{await db.exec('set local role myth_p15_dbpr_runtime;');const args=make('schema-failure');args[3]='[]';args[4]='SOURCE_SCHEMA_INVALID';const failed=await poll(args);check('schema failure records unsuccessful check',failed.checked===0&&failed.changes===0);await db.exec('reset role;');check('schema drift requires review',(await query('select monitoring_status from network.watch_capability_observation_contracts where capability_id=$1',[v2]))[0].monitoring_status==='degraded');});
 await sandbox(async()=>{await db.exec('set local role myth_p15_dbpr_runtime;');const args=[...baselineArgs];args[0]='same-time-conflict';const items=JSON.parse(args[3]);items[0].primary_status='current';items[0].official_status='Current,Active';args[3]=JSON.stringify(items);const conflict=await poll(args);check('conflicting status at same retrieval time quarantines',conflict.quarantined>0&&conflict.changes===0);});
 await db.exec('set role myth_p15_dbpr_runtime;');
 for(const[name,change]of[
  ['mismatched official and normalized statuses',rows=>{rows[0].primary_status='current';}],
  ['duplicate exact identities',rows=>{rows[1]=rows[0];}],
  ['unrelated data fields',rows=>{rows[0].email='not-allowed@example.invalid';}],
  ['unapproved source URL',rows=>{rows[0].source_url='https://example.invalid/';}],
  ['manufactured source-as-of',rows=>{rows[0].source_as_of=rows[0].retrieved_at;}],
  ['out-of-window retrieval clock',rows=>{rows[0].retrieved_at='2099-01-01T00:00:00Z';}],
 ]){const args=make(name),items=JSON.parse(args[3]);change(items);args[3]=JSON.stringify(items);await denied(name+' rejected',pollSql,args);}
 await denied('null payload rejected',pollSql,['null',new Date().toISOString(),new Date().toISOString(),null,null]);
 await db.exec('reset role;');
 await sandbox(async()=>{await query('update network.watch_capability_observation_contracts set mass_change_threshold=1 where capability_id=$1',[v2]);await db.exec('set local role myth_p15_dbpr_runtime;');const mass=await poll(make('mass-change','current','inactive'));check('mass change invokes quarantine',mass.quarantined>0&&mass.health==='degraded');await db.exec('reset role;');check('mass quarantine stays locked to operator review',(await query('select monitoring_status from network.watch_capability_observation_contracts where capability_id=$1',[v2]))[0].monitoring_status==='quarantined');check('batch events cannot remain active after mass quarantine',(await query("select count(*)::int n from network.network_change_events where checkpoint_id=$1 and status='active'",[mass.checkpoint]))[0].n===0);});
 check('zero consumer Alerts and deliveries with all P11-P19 tables present',(await query("select (select count(*) from consumer.consumer_alerts)+(select count(*) from ops.consumer_alert_deliveries) n"))[0].n===0);
 check('Watch count preserved throughout consent',(await query('select count(*)::int n from consumer.consumer_watches'))[0].n===2);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(results,null,2));console.log(JSON.stringify({tests:results.length,failed:results.filter(r=>!r.pass)}));
}catch(error){console.error(JSON.stringify({message:error.message,code:error.code,where:error.where,completedChecks:results.length}));process.exitCode=1;}finally{await db.close();}

