import {hash,RuntimeError} from './runtime.ts';
import type {BrowserBindings,Confirmation} from './browser.ts';
import type {TransactionConnection,TransactionPool} from './postgres-backend.ts';
/** Parent-only cookie-capability storage; not exposed through PostgREST/BFF.
 * Session advisory lock spans calls; checkpoints are independently durable before
 * any P13 consume. No long DB transaction is held across a remote source call. */
type ConfirmationStore=BrowserBindings['store'];
export class PostgresConfirmationStore implements ConfirmationStore {
  private readonly pool:TransactionPool;
  constructor(pool:TransactionPool,sessionAffinity:'dedicated'){if(sessionAffinity!=='dedicated')throw new RuntimeError('unavailable');this.pool=pool;}
  private async transaction<T>(db:TransactionConnection,key:string,work:()=>Promise<T>):Promise<T>{
    await db.query('begin',[]);
    try{await db.query('set local role myth_v23_browser_store',[]);
      await db.query("set local statement_timeout='5s'",[]);
      await db.query("select set_config('v23.confirmation_key',$1,true)",[key]);
      const r=await work();await db.query('commit',[]);return r;
    }catch(e){await db.query('rollback',[]).catch(()=>{});throw e;}
  }
  private key(value:string){if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw new RuntimeError('invalid');return hash(value);}
  async put(value:string,c:Confirmation){
    const key=this.key(value),db=await this.pool.connect();
    try{await this.transaction(db,key,()=>db.query('insert into v23_private.browser_confirmations(key_hash,payload) values($1,$2)',[key,JSON.stringify(c)]));}
    finally{db.release();}
  }
  async withRecord<T>(value:string,work:(c:Confirmation|null,checkpoint:()=>Promise<void>)=>Promise<T>):Promise<T>{
    const key=this.key(value),db=await this.pool.connect();let locked=false;
    try{
      // Nonblocking bounded contention: browser retries instead of a hung worker.
      const lock=await db.query<{locked:boolean}>('select pg_try_advisory_lock(hashtextextended($1,0)) as locked',['v23-browser:'+key]);
      if(!lock.rows[0]?.locked)throw new RuntimeError('conflict');locked=true;
      const read=await this.transaction(db,key,()=>db.query<{payload:Confirmation}>('select payload from v23_private.browser_confirmations where key_hash=$1',[key]));
      const c=read.rows[0]?.payload??null;
      let originalOwner=c?.parent?.subject;
      const originalSource=c?JSON.stringify(c.source):null;
      const checkpoint=async()=>{
        if(!c)return;
        if((originalOwner&&c.parent?.subject!==originalOwner)||JSON.stringify(c.source)!==originalSource)throw new RuntimeError('conflict');
        const updated=await this.transaction(db,key,()=>db.query('update v23_private.browser_confirmations set payload=$2 where key_hash=$1 returning key_hash',[key,JSON.stringify(c)]));
        if(updated.rows.length!==1)throw new RuntimeError('expired');
        originalOwner=c.parent?.subject;
      };
      try{const result=await work(c,checkpoint);await checkpoint();return result;}
      catch(e){await checkpoint();throw e;}
    }finally{
      if(locked)await db.query('select pg_advisory_unlock(hashtextextended($1,0))',['v23-browser:'+key]).catch(()=>{});
      db.release();
    }
  }
}
