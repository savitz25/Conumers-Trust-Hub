/** Durable parent store. Dependency-injected scoped pool only: no env lookup,
 * service-role fallback, role switching or schema/permission creation here. */
import type { RuntimeBackend, RuntimeTransaction } from './runtime.ts';
import type { FoundationSql } from './p12-p13.ts';
export interface TransactionConnection extends FoundationSql { release(destroy?: boolean): void }
export interface TransactionPool { connect(): Promise<TransactionConnection> }
type Foundations = Pick<RuntimeTransaction, 'resolveProfile' | 'resolveReturnTask' | 'consumeP13' | 'saveP12' | 'addProjectP12'>;
type RecordKind = Parameters<RuntimeTransaction['put']>[0];
/** Factory verifies current owner and wires authorized P12/P13 operations on
 * THIS connection. It must not make remote RPCs or open a second transaction.
 * Required capabilities are intentionally not granted by this code. */
export type TransactionFoundations = (connection: TransactionConnection) => Promise<Foundations>;

export class PostgresRuntimeBackend implements RuntimeBackend {
  readonly pool: TransactionPool;
  readonly foundations: TransactionFoundations;
  constructor(pool: TransactionPool, foundations: TransactionFoundations) { this.pool = pool; this.foundations = foundations; }
  async rateLimit(key: string, now: number, maximum: number): Promise<boolean> {
    const db = await this.pool.connect();
    try {
      const r = await db.query<{ count: number }>(
        `insert into ops.v23_profile_runtime_quota(bucket,window_start,count) values($1,$2,1)
         on conflict(bucket) do update set window_start=excluded.window_start,
           count=case when ops.v23_profile_runtime_quota.window_start=excluded.window_start
             then ops.v23_profile_runtime_quota.count+1 else 1 end returning count`, [key, Math.floor(now / 60_000)]);
      return Number(r.rows[0]?.count) <= maximum;
    } finally { db.release(); }
  }
  async transaction<T>(work: (tx: RuntimeTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const db = await this.pool.connect();
      try {
        await db.query('begin isolation level serializable', []);
        await db.query("set local statement_timeout='5s'", []);
        await db.query("set local lock_timeout='3s'", []);
        const foundations = await this.foundations(db);
        const lock = async (kind: RecordKind, key: string) => {
          // Also locks absent receipt/continuation keys across worker processes.
          await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`v23:${kind}:${key}`]);
        };
        const tx: RuntimeTransaction = { ...foundations,
          read: async <V>(kind: RecordKind, key: string): Promise<V | null> => {
            await lock(kind, key);
            const r = await db.query<{ payload: V }>('select payload from ops.v23_profile_runtime_records where kind=$1 and key_hash=$2 for update', [kind, key]);
            return r.rows[0]?.payload ?? null;
          },
          put: async (kind, key, value) => {
            await lock(kind, key);
            await db.query(`insert into ops.v23_profile_runtime_records(kind,key_hash,payload) values($1,$2,$3)
              on conflict(kind,key_hash) do update set payload=excluded.payload`, [kind, key, JSON.stringify(value)]);
          },
        };
        const result = await work(tx);
        await db.query('commit', []);
        return result;
      } catch (error) {
        await db.query('rollback', []).catch(() => {});
        const code = (error as { code?: string })?.code;
        if (attempt >= 2 || !['40001', '40P01'].includes(code ?? '')) throw error;
        // Failed transaction has no published receipt or partial P12/P13 state.
      } finally { db.release(); }
    }
  }
}
