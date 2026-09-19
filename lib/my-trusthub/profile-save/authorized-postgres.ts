/** Production-shaped capability adapter. The parent-only pool is dependency
 * injected; never use a specialist credential, service_role or SQLite fallback. */
import {hash,RuntimeError,type RuntimeAuthorization,type RuntimeBackend,type RuntimeTransaction} from './runtime.ts';
import type {TransactionPool,TransactionConnection} from './postgres-backend.ts';
import type {P13Proof} from './p12-p13.ts';
import type {ProfileIdentity,TrustedProfile} from '../contracts/v2-3-profile-save.ts';
import type {ProfileReturnTask} from '../contracts/v2-3-profile-transfer.ts';
export type AuthorizedPostgresPorts={
  pool:TransactionPool;
  /** Revalidate caller/session + actual independently authenticated hub service.
   * Must not merely echo the supplied RuntimeAuthorization. */
  verify(a:RuntimeAuthorization):Promise<boolean>;
  profile(identity:ProfileIdentity):Promise<TrustedProfile|null>;
  returnTask(identity:ProfileIdentity):Promise<ProfileReturnTask|null>;
  project(ref:string,a:RuntimeAuthorization):Promise<string|null>;
  exchange(ref:string,a:RuntimeAuthorization):Promise<P13Proof|null>;
};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export class AuthorizedPostgresBackend implements RuntimeBackend {
  private readonly ports:AuthorizedPostgresPorts;
  constructor(ports:AuthorizedPostgresPorts){this.ports=ports;}
  private async authorized<T>(a:RuntimeAuthorization|undefined,work:(db:TransactionConnection,proof:P13Proof|null,projectId:string|null)=>Promise<T>):Promise<T>{
    if(!a||a.caller.environment!=='isolated'||!await this.ports.verify(a))throw new RuntimeError('unauthorized');
    const who=structuredClone(a.caller),input=structuredClone(a.input) as Record<string,unknown>;
    if(!/^[A-Za-z0-9_-]{43}$/.test(who.browserBinding)|| (who.parent&&!uuid(who.parent.subject)))throw new RuntimeError('unauthorized');
    const proof=a.operation==='consumeProfileSaveContinuation'&&who.exchange?await this.ports.exchange(who.exchange,a):null;
    if(a.operation==='consumeProfileSaveContinuation'&&!proof)throw new RuntimeError('unauthorized');
    const projectId=typeof input?.projectRef==='string'?await this.ports.project(input.projectRef,a):null;
    if(projectId&&!uuid(projectId))throw new RuntimeError('unauthorized');
    const authority={hub:who.hub,audience:'ask',service:`svc:trusthub:${who.hub}:bff:v1`,scopes:who.scopes,
      subject:who.parent?.subject??null,session:who.parent?hash(who.parent.sessionBinding):null,browser:hash(who.browserBinding),
      operation:a.operation,input,projectId,exchangeProof:proof,quotaKey:hash(JSON.stringify([who.hub,who.browserBinding,a.operation])),
      receiptKey:who.parent?hash(JSON.stringify([who.parent.subject,input?.accountContextRef,input?.requestKey])):null};
    for(let attempt=0;;attempt++){
      const db=await this.ports.pool.connect();
      try{
        await db.query('begin isolation level serializable',[]);
        await db.query("set local statement_timeout='5s'",[]);await db.query("set local lock_timeout='3s'",[]);
        // Roles are fixed SQL constants, never interpolated from request/service.
        await db.query('set local role myth_v23_authorizer',[]);
        await db.query('insert into v23_private.transaction_authority(backend,transaction_id,authority) values(pg_backend_pid(),txid_current(),$1)',[JSON.stringify(authority)]);
        await db.query('set local role myth_v23_executor',[]);
        const value=await work(db,proof,projectId);
        if(!await this.ports.verify(a))throw new RuntimeError('unauthorized');
        await db.query('set local role myth_v23_authorizer',[]);
        await db.query('delete from v23_private.save_validation where backend=pg_backend_pid() and transaction_id=txid_current()',[]);
        await db.query('delete from v23_private.exchange_validation where backend=pg_backend_pid() and transaction_id=txid_current()',[]);
        await db.query('delete from v23_private.transaction_authority where backend=pg_backend_pid() and transaction_id=txid_current()',[]);
        await db.query('commit',[]);return value;
      }catch(e){await db.query('rollback',[]).catch(()=>{});
        if(attempt>=2||!['40001','40P01'].includes((e as {code?:string}).code??''))throw e;
      }finally{db.release();}
    }
  }
  rateLimit(key:string,now:number,maximum:number,a?:RuntimeAuthorization){
    return this.authorized(a,async db=>{
      const r=await db.query<{count:number}>(`insert into ops.v23_profile_runtime_quota(bucket,window_start,count) values($1,$2,1)
        on conflict(bucket) do update set window_start=excluded.window_start,count=case when ops.v23_profile_runtime_quota.window_start=excluded.window_start
        then ops.v23_profile_runtime_quota.count+1 else 1 end returning count`,[key,Math.floor(now/60000)]);
      return Number(r.rows[0]?.count)<=maximum;
    });
  }
  transaction<T>(work:(tx:RuntimeTransaction)=>Promise<T>,a?:RuntimeAuthorization):Promise<T>{
    return this.authorized(a,async(db,proof,projectId)=>{
      const lock=async(kind:string,key:string)=>{await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`v23:${kind}:${key}`]);};
      return work({
        read:async<V>(kind:Parameters<RuntimeTransaction['read']>[0],key:string)=>{await lock(kind,key);
          return (await db.query<{payload:V}>('select payload from ops.v23_profile_runtime_records where kind=$1 and key_hash=$2',[kind,key])).rows[0]?.payload??null;},
        put:async(kind,key,value)=>{await lock(kind,key);await db.query(`insert into ops.v23_profile_runtime_records(kind,key_hash,payload) values($1,$2,$3)
          on conflict(kind,key_hash) do update set payload=excluded.payload`,[kind,key,JSON.stringify(value)]);},
        resolveProfile:i=>this.ports.profile(i),resolveReturnTask:i=>this.ports.returnTask(i),
        consumeP13:async()=>{const r=await db.query<{subject:string}>('select v23_private.consume_context($1) as subject',[JSON.stringify(proof)]);
          if(r.rows[0]?.subject!==a?.caller.parent?.subject)throw new RuntimeError('unauthorized');return {subject:r.rows[0].subject};},
        saveP12:async(bindingId)=>{const r=await db.query<{saved_entity_id:string;created:boolean;restored:boolean}>('select * from v23_private.save_profile($1)',[bindingId]);
          if(!r.rows[0]?.saved_entity_id)throw new RuntimeError('unavailable');return {savedRef:r.rows[0].saved_entity_id,created:r.rows[0].created,restored:r.rows[0].restored};},
        addProjectP12:async(_ref,saved)=>{
          if(!projectId)return 'failed';await db.query('savepoint v23_project',[]);
          try{const r=await db.query<{added:boolean}>('select v23_private.add_project($1,$2) as added',[projectId,saved]);
            if(typeof r.rows[0]?.added!=='boolean')throw new Error('missing membership');await db.query('release savepoint v23_project',[]);return r.rows[0].added?'added':'already_member';
          }catch{await db.query('rollback to savepoint v23_project',[]);await db.query('release savepoint v23_project',[]);return 'failed';}
        }
      });
    });
  }
}
