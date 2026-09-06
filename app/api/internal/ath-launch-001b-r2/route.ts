import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { applyCustomerMigrations, enableAppRole, askDatabaseUrl } from '@/lib/customer/db';
import { assertR2FixtureEnvironment, cleanupR2Fixture, createR2Fixture, R2_FIXTURE, verifyR2Fixture } from '@/lib/customer/browser-fixture';
import { withPlatform } from '@/lib/customer/server';
import type { SqlClient } from '@/lib/customer/sql';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };

function relativeMagicLink(preview?: string): string {
  const raw=preview?.match(/https?:\/\/[^\s]+\/api\/customer\/auth\/verify\?[^\s]+/)?.[0];
  if (!raw) throw new Error('fixture_magic_link_unavailable');
  const url=new URL(raw);
  return `${url.pathname}${url.search}`;
}

async function fixtureTransaction<T>(work:(sql:SqlClient)=>Promise<T>):Promise<T>{
  const connectionString=askDatabaseUrl();
  if(!connectionString)throw new Error('fixture_database_missing');
  const pool=new Pool({connectionString,max:1,ssl:{rejectUnauthorized:false}});
  const client=await pool.connect();
  try{
    const schemaExists=(await client.query<{exists:boolean}>(`SELECT to_regclass('public.ath_users') IS NOT NULL AS exists`)).rows[0]?.exists;
    if(!schemaExists)await applyCustomerMigrations({query:(text,params)=>client.query(text,params)});
    await client.query('BEGIN');
    await enableAppRole({query:(text,params)=>client.query(text,params)});
    const result=await work({query:(text,params)=>client.query(text,params)});
    await client.query('COMMIT');
    return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}
  finally{client.release();await pool.end();}
}

export async function POST(request:Request){
  try{
    assertR2FixtureEnvironment(process.env,request.headers.get('x-ath-fixture-confirmation')||'');
    const body=await request.json().catch(()=>({})) as {action?:string};
    if(body.action==='create'){
      const fixture=await fixtureTransaction(async sql=>{await createR2Fixture(sql);return verifyR2Fixture(sql);});
      const owner=await withPlatform(p=>p.requestMagicLink({email:R2_FIXTURE.ownerEmail,purpose:'login',nextPath:'/manage'}));
      const empty=await withPlatform(p=>p.requestMagicLink({email:R2_FIXTURE.emptyEmail,purpose:'login',nextPath:'/manage'}));
      return NextResponse.json({ok:true,fixture,ownerAuthPath:relativeMagicLink(owner.preview),emptyAuthPath:relativeMagicLink(empty.preview)},{headers});
    }
    if(body.action==='verify')return NextResponse.json({ok:true,fixture:await fixtureTransaction(verifyR2Fixture)},{headers});
    if(body.action==='cleanup'){
      await fixtureTransaction(cleanupR2Fixture);
      return NextResponse.json({ok:true,fixture:await fixtureTransaction(verifyR2Fixture)},{headers});
    }
    return NextResponse.json({ok:false,error:'fixture_action_invalid'},{status:400,headers});
  }catch(error){
    const message=error instanceof Error?error.message:'fixture_failed';
    const status=/refused|not_enabled|confirmation/.test(message)?404:500;
    return NextResponse.json({ok:false,error:message},{status,headers});
  }
}
