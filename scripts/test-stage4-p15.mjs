// Isolated in-memory PostgreSQL only. Never connects to production.
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
const root=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite({extensions:{pgcrypto,btree_gist}});
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key, aud text, role text, email text, created_at timestamptz, updated_at timestamptz, raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to public; grant execute on function auth.uid() to public;`);
 for(const file of fs.readdirSync(root+'supabase/migrations').sort().filter(f=>f<'20260908153000'||f.startsWith('20260910'))) {console.log('migration',file);await db.exec(fs.readFileSync(root+'supabase/migrations/'+file,'utf8'));}
 for(const file of ['p14_watch_capabilities_validation.sql','p15_monitoring_validation.sql']) await db.exec(fs.readFileSync(root+'supabase/seeds/'+file,'utf8'));
 const results=await db.exec('begin;\n'+fs.readFileSync(root+'supabase/tests/p15_source_observations.sql','utf8'));
 const matrix=results.flatMap(r=>r.rows??[]).filter(r=>'passed' in r);
 if(process.argv[2]) fs.writeFileSync(process.argv[2],JSON.stringify(matrix,null,2));
 console.log(JSON.stringify({tests:matrix.length,failed:matrix.filter(r=>!r.passed)}));
 if(!matrix.length||matrix.some(r=>!r.passed)) process.exitCode=1;
}catch(e){console.error(JSON.stringify({code:e.code,message:e.message,where:e.where}));process.exitCode=1;}finally{await db.close();}
