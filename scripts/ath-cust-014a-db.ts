import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { enableAppRole } from '../lib/customer/migrate.ts';

const connectionString=process.env.neon_tech_database||process.env.ASK_DATABASE_URL;
if(!connectionString||connectionString==='[SENSITIVE]')throw new Error('Ask Neon credential unavailable');
const pool=new Pool({connectionString,ssl:{rejectUnauthorized:false},max:1});
const client=await pool.connect();
try{
  await client.query('BEGIN');
  await enableAppRole({query:(text,params)=>client.query(text,params)});
  const before=await client.query(`SELECT (SELECT count(*) FROM ath_hub_profiles)::text profiles,(SELECT count(*) FROM ath_claims)::text claims,(SELECT count(*) FROM ath_management_grants)::text grants`);
  if(process.argv.includes('--apply')){
    await client.query(`SET LOCAL lock_timeout='15s'`);
    await client.query(readFileSync(join(process.cwd(),'schema/migrations/010_ath_insurance_customer_foundation.sql'),'utf8'));
  }
  const constraints=await client.query(`SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='ath_hub_profiles'::regclass AND conname LIKE 'ath_hub_profiles_%_check' ORDER BY conname`);
  const rls=await client.query(`SELECT count(*)::text total,count(*) FILTER(WHERE relrowsecurity)::text rls,count(*) FILTER(WHERE relforcerowsecurity)::text forced FROM pg_class WHERE relname LIKE 'ath_%' AND relkind='r'`);
  const after=await client.query(`SELECT (SELECT count(*) FROM ath_hub_profiles)::text profiles,(SELECT count(*) FROM ath_claims)::text claims,(SELECT count(*) FROM ath_management_grants)::text grants,(SELECT count(*) FROM (SELECT hub_id,native_profile_id FROM ath_hub_profiles GROUP BY hub_id,native_profile_id HAVING count(*)>1)x)::text duplicates,(SELECT count(*) FROM ath_hub_profiles WHERE hub_id='insurance')::text insurance_profiles`);
  console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'audit',before:before.rows[0],after:after.rows[0],rls:rls.rows[0],constraints:constraints.rows},null,2));
  if(process.argv.includes('--apply'))await client.query('COMMIT');else await client.query('ROLLBACK');
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await pool.end()}
