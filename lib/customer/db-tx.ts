/**
 * ATH-SENTRY-P2 — transaction core, split out of db.ts so it can be exercised with an injected pool (no Neon,
 * no `server-only`). db.ts wires the real pool, the structured log and the bounded Sentry signal.
 */
import { DbUnavailableError, classifyDbError } from './db-unavailable.ts';

export type TxClient = { query(text: string, params?: unknown[]): Promise<unknown>; release(): void };
export type TxPool = { connect(): Promise<TxClient> };
export type TxHooks = {
  /** Called at most once per failed transaction when the failure is classified as availability. */
  onUnavailable?: (error: DbUnavailableError) => void;
  /** Existing RLS/permission diagnostic hook (unchanged behaviour). */
  onAuthorizationFailure?: (message: string) => void;
};

/**
 * BEGIN → set_config(app_role) → fn → COMMIT; ROLLBACK on any error. A provider/connectivity failure (at
 * connect or during the transaction) is rethrown as DbUnavailableError; every other error is rethrown as-is.
 * No retry of any kind is performed here.
 */
export async function runTransaction<T>(pool: TxPool, fn: (client: TxClient) => Promise<T>, hooks: TxHooks = {}): Promise<T> {
  let client: TxClient;
  try {
    client = await pool.connect();
  } catch (err) {
    throw unavailableOrRethrow(err, 'connect', hooks);
  }
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('ath.app_role', 'server', true)");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore: the connection may already be gone */ }
    const message = err instanceof Error ? err.message : String(err);
    if (/row-level security|permission denied|ath.app_role/i.test(message)) hooks.onAuthorizationFailure?.(message);
    throw unavailableOrRethrow(err, 'query', hooks);
  } finally {
    try { client.release(); } catch { /* ignore */ }
  }
}

function unavailableOrRethrow(err: unknown, phase: 'connect' | 'query', hooks: TxHooks): unknown {
  if (err instanceof DbUnavailableError) return err; // nested withAskTx: already classified once
  const c = classifyDbError(err);
  if (!c.unavailable) return err;
  const wrapped = new DbUnavailableError({ reason: c.reason, sqlstate: c.sqlstate, errno: c.errno, phase, cause: err });
  try { hooks.onUnavailable?.(wrapped); } catch { /* observability must never change the failure */ }
  return wrapped;
}
