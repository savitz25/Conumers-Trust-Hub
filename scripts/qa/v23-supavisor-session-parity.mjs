// Hosted probe: read-only or transaction-rollback only. Never logs connection material.
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {databaseConnectionConfig,RUNTIME_POOL_MAX} from '../../lib/my-trusthub/profile-save/database-config.ts';
import {PARENT_LOGIN} from '../../lib/my-trusthub/profile-save/isolated-config.ts';
const env={...process.env,MY_TRUSTHUB_V23_DATABASE_CONNECTION_MODE:'SUPAVISOR_SESSION',
  MY_TRUSTHUB_V23_PARENT_DATABASE_URL:process.env.V23_SUPAVISOR_SESSION_DATABASE_URL,
  MY_TRUSTHUB_V23_DATABASE_CA_PEM:process.env.V23_SUPAVISOR_SESSION_CA_PEM,
  MY_TRUSTHUB_V23_SUPAVISOR_SESSION_HOST:process.env.V23_EXPECTED_SUPAVISOR_SESSION_HOST};
const c=databaseConnectionConfig(env);if(!c)throw Error('Invalid or missing exact Supavisor SESSION inputs');
const pool=new Pool({host:c.host,port:c.port,database:c.database,user:c.user,password:c.password,
 ssl:{ca:c.ca,rejectUnauthorized:true,servername:c.host},max:RUNTIME_POOL_MAX,connectionTimeoutMillis:5000,
 idleTimeoutMillis:10000,application_name:'v23-session-parity-probe'});
try{
 const a=await pool.connect(),b=await pool.connect();
 try{
  const id=(await a.query('select current_database() db,current_user usr,session_user sess,pg_backend_pid() pid')).rows[0];
  assert.equal(id.db,'postgres');assert.equal(id.usr,PARENT_LOGIN);assert.equal(id.sess,PARENT_LOGIN);
  assert.equal((await a.query('select pg_backend_pid() pid')).rows[0].pid,id.pid);
  assert.equal(a.connection.stream.authorized,true,'TLS certificate/hostname must authorize');
  const timeouts=(await a.query("select current_setting('statement_timeout') statement_timeout,current_setting('lock_timeout') lock_timeout,current_setting('idle_in_transaction_session_timeout') idle_timeout")).rows[0];
  assert.deepEqual(timeouts,{statement_timeout:'5s',lock_timeout:'3s',idle_timeout:'10s'});
  await a.query('set role myth_v23_authorizer');assert.equal((await a.query('select current_user u')).rows[0].u,'myth_v23_authorizer');await a.query('reset role');
  await a.query('set role myth_v23_executor');assert.equal((await a.query('select current_user u')).rows[0].u,'myth_v23_executor');await a.query('reset role');
  await assert.rejects(a.query('set role myth_v23_cleanup'));
  await a.query('begin isolation level serializable');await a.query("set local role myth_v23_authorizer;set local statement_timeout='4s';set local lock_timeout='2s'");
  assert.equal((await a.query("select current_setting('transaction_isolation') level,pg_try_advisory_xact_lock(hashtextextended('v23-parity-xact',0)) locked")).rows[0].level,'serializable');
  await a.query('savepoint v23_probe');await a.query("set local application_name='v23-savepoint'");await a.query('rollback to savepoint v23_probe');await a.query('rollback');
  assert.equal((await a.query('select current_user u')).rows[0].u,PARENT_LOGIN);
  assert.equal((await a.query("select pg_try_advisory_lock(hashtextextended('v23-parity-session',0)) locked")).rows[0].locked,true);
  assert.equal((await b.query("select pg_try_advisory_lock(hashtextextended('v23-parity-session',0)) locked")).rows[0].locked,false);
  assert.equal((await a.query("select pg_advisory_unlock(hashtextextended('v23-parity-session',0)) unlocked")).rows[0].unlocked,true);
  assert.equal((await b.query("select pg_try_advisory_lock(hashtextextended('v23-parity-session',0)) locked")).rows[0].locked,true);
  await b.query("select pg_advisory_unlock(hashtextextended('v23-parity-session',0))");
  assert.notEqual((await b.query('select pg_backend_pid() pid')).rows[0].pid,id.pid);
  const limit=(await a.query("select rolconnlimit from pg_roles where rolname=$1",[PARENT_LOGIN])).rows[0].rolconnlimit;
  assert.equal(limit,6);assert.ok(RUNTIME_POOL_MAX<limit);
  await a.query("set application_name='v23-probe-dirty';reset application_name;reset role");
 }finally{a.release();b.release();}
 const clean=await pool.connect();try{const s=(await clean.query("select current_user u,current_setting('application_name') app")).rows[0];assert.equal(s.u,PARENT_LOGIN);assert.equal(s.app,'v23-session-parity-probe');}finally{clean.release();}
 console.log('V23_SUPAVISOR_SESSION_PARITY_PASS');
}finally{await pool.end();}
