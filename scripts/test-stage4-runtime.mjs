// Isolated in-memory PostgreSQL only. Never connects to production.
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {PGlite}from '@electric-sql/pglite';
import {pgcrypto}from '@electric-sql/pglite/contrib/pgcrypto';
import {btree_gist}from '@electric-sql/pglite/contrib/btree_gist';
const root=fileURLToPath(new URL('../',import.meta.url));const db=new PGlite({extensions:{pgcrypto,btree_gist}});const result=[];
const check=(name,pass)=>{result.push({name,pass});assert(pass,name);};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to public;grant execute on function auth.uid()to public;`);
 for(const f of fs.readdirSync(root+'supabase/migrations').sort().filter(f=>f<'20260908153000'||f.startsWith('20260910')))await db.exec(fs.readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.exec(fs.readFileSync(root+'supabase/seeds/p14_watch_capabilities_validation.sql','utf8'));
 let seed=fs.readFileSync(root+'supabase/seeds/p15_monitoring_validation.sql','utf8').replaceAll("'monitoring/v1'","'contractor.fl.dbpr.license_status/v1'").replaceAll('Active','active').replaceAll('Inactive','inactive').replaceAll("'status.transition'","'status_transition'");await db.exec(seed);
 const fixture=fs.readFileSync(root+'supabase/tests/p15_source_observations.sql','utf8').split('-- Healthy baseline run.')[0];await db.exec(fixture);
 await db.exec("grant myth_p15_dbpr_runtime to postgres;commit;set role myth_p15_dbpr_runtime;");
 const rows=[{credential:'P15-LIC-1',status:'active'},{credential:'P15-LIC-2',status:'active'}];
 let tick=-60;
 async function run(id,items=rows,failure=null){const t=new Date(Date.now()+tick*1000).toISOString();tick+=5;return(await db.query('select ops.run_dbpr_poll($1,$2,$2,$2,$3::jsonb,$4) as result',[id,t,JSON.stringify(items),failure])).rows[0].result;}
 const a=await run('base');check('scoped wrapper accepts baseline',a.checked===2&&a.changes===0&&a.quarantined===0);
 const b=await run('same');check('same data produces no change',b.checked===2&&b.changes===0);
 const c=await run('change',rows.map(r=>({...r,status:'inactive'})));check('scoped wrapper generates status events',c.changes===2&&c.quarantined===0);
 const d=await run('repeat',rows.map(r=>({...r,status:'inactive'})));check('repeat material value produces no duplicate events',d.changes===0);
 const x=await run('failure',[],'SOURCE_IDENTITY_MISSING');check('missing exact input fails health without observation',x.checked===0&&x.changes===0&&['unknown','degraded'].includes(x.health));
 try{await db.query("select ops.run_dbpr_poll('null',now(),now(),now(),null,null)");check('null payload denied',false);}catch{check('null payload denied',true);}
 try{await db.query('select * from consumer.consumer_watches');check('wrapper role private read denied',false);}catch{check('wrapper role private read denied',true);}
 await db.exec('reset role;');const counts=(await db.query('select (select count(*) from network.source_observations) observations,(select count(*) from network.network_change_events) events')).rows[0];check('expected deterministic observation/event counts',Number(counts.observations)===8&&Number(counts.events)===2);
 if(process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){console.error(JSON.stringify({message:e.message,code:e.code,where:e.where}));process.exitCode=1;}finally{await db.close();}
