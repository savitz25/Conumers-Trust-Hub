import { randomBytes } from 'node:crypto';
import { hash, RuntimeError } from './runtime.ts';
import type { TransactionConnection, TransactionPool } from './postgres-backend.ts';
import type { BrowserBindings, Confirmation } from './browser.ts';
import { opaque } from './isolated-config.ts';

export const randomRef = () => randomBytes(32).toString('base64url');
/** All durable state is PostgreSQL. A key-scoped transaction is used for each
 * read/write; sessions/admission are separately verified by the caller. */
export class PreviewStore {
  readonly pool: TransactionPool;
  constructor(pool: TransactionPool) { this.pool = pool; }
  async authorized<T>(work: (db: TransactionConnection) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try { await db.query('begin', []); await db.query('set local role myth_v23_authorizer', []);
      await db.query("set local statement_timeout='5s'", []);
      const result = await work(db); await db.query('commit', []); return result;
    } catch (e) { await db.query('rollback', []).catch(() => {}); throw e; }
    finally { db.release(); }
  }
  async record<T>(key: string, work: (current: T | null) => Promise<{ value?: T; expiresAt?: number; result: unknown }>) {
    return this.authorized(async db => {
      const keyHash = hash(key);
      await db.query("select set_config('v23.transport_key',$1,true)", [keyHash]);
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['v23-preview:' + keyHash]);
      const row = (await db.query<{ payload: T }>('select payload from v23_private.preview_transport_records where key_hash=$1 and expires_at>clock_timestamp()', [keyHash])).rows[0];
      const update = await work(row?.payload ?? null);
      if (update.value !== undefined) {
        if (!Number.isFinite(update.expiresAt) || update.expiresAt! <= Date.now()) throw new RuntimeError('expired');
        await db.query(`insert into v23_private.preview_transport_records(key_hash,payload,expires_at) values($1,$2,to_timestamp($3/1000.0))
          on conflict(key_hash) do update set payload=excluded.payload,expires_at=excluded.expires_at`, [keyHash, JSON.stringify(update.value), update.expiresAt]);
      }
      return update.result;
    });
  }
  async read<T>(key: string): Promise<T | null> { return await this.record<T>(key, async current => ({ result: current })) as T | null; }
  async put<T>(key: string, value: T, expiresAt: number, once = false): Promise<void> {
    await this.record<T>(key, async current => { if (once && current) throw new RuntimeError('conflict'); return { value, expiresAt, result: null }; });
  }
  async claim(key: string, expiresAt: number): Promise<boolean> {
    return await this.record('nonce:' + key, async current => current ? { result: false } : { value: { used: true }, expiresAt, result: true }) as boolean;
  }
  async live(subject: string, session: string): Promise<boolean> {
    return this.authorized(async db => (await db.query<{ live: boolean }>('select v23_private.preview_session_live($1,$2) as live', [subject, session])).rows[0]?.live === true);
  }
}

/** Uses the existing durable confirmation table through exact-cookie wrappers.
 * The runtime login needs no browser_store membership. The session lock spans
 * checkpoints but no SQL transaction is held across source HTTP or Auth calls. */
type ConfirmationStore = BrowserBindings['store'];
export class PreviewConfirmationStore implements ConfirmationStore {
  readonly pool: TransactionPool;
  constructor(pool: TransactionPool) { this.pool = pool; }
  private async access(db: TransactionConnection, action: string, key: string, value: Confirmation | null = null): Promise<Confirmation | null> {
    await db.query('begin', []);
    try { await db.query('set local role myth_v23_authorizer', []);
      const r = await db.query<{ payload: Confirmation | null }>('select v23_private.preview_confirmation($1,$2,$3) as payload', [action, key, value === null ? null : JSON.stringify(value)]);
      await db.query('commit', []); return r.rows[0]?.payload ?? null;
    } catch (e) { await db.query('rollback', []).catch(() => {}); throw e; }
  }
  async put(ref: string, value: Confirmation) {
    if (!opaque(ref)) throw new RuntimeError('invalid');
    const db = await this.pool.connect(); try { await this.access(db, 'insert', hash(ref), value); } finally { db.release(); }
  }
  async withRecord<T>(ref: string, work: (c: Confirmation | null, checkpoint: () => Promise<void>) => Promise<T>): Promise<T> {
    if (!opaque(ref)) throw new RuntimeError('invalid');
    const db = await this.pool.connect(), key = hash(ref); let locked = false, destroy = false;
    try {
      locked = (await db.query<{ locked: boolean }>('select pg_try_advisory_lock(hashtextextended($1,0)) as locked', ['v23-browser:' + key])).rows[0]?.locked === true;
      if (!locked) throw new RuntimeError('conflict');
      const c = await this.access(db, 'read', key);
      const checkpoint = async () => { if (c && !await this.access(db, 'update', key, c)) throw new RuntimeError('expired'); };
      try { const result = await work(c, checkpoint); await checkpoint(); return result; }
      catch (e) { await checkpoint(); throw e; }
    } finally {
      if (locked) {
        try { destroy = (await db.query<{ unlocked: boolean }>('select pg_advisory_unlock(hashtextextended($1,0)) as unlocked', ['v23-browser:' + key])).rows[0]?.unlocked !== true; }
        catch { destroy = true; }
      }
      // A failed unlock never returns a stateful session to another borrower.
      db.release(destroy);
    }
  }
}
