import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizedPostgresBackend } from './authorized-postgres.ts';
import { RUNTIME_POOL_MAX } from './database-config.ts';
import type { TransactionConnection, TransactionPool } from './postgres-backend.ts';
import type { RuntimeAuthorization } from './runtime.ts';

function limitedPool(max: number): TransactionPool {
  let used = 0;
  return {
    async connect(): Promise<TransactionConnection> {
      if (used >= max) throw new Error('timeout exceeded when trying to connect');
      used += 1;
      let released = false;
      return {
        async query() { return { rows: [] }; },
        release() { if (!released) { released = true; used -= 1; } },
      };
    },
  };
}

/** Mirrors Confirm Save: the browser lock stays checked out while resume's
 * transaction re-checks the parent, and that re-check binds on its own connection. */
async function resumeWhileConfirmationLocked(max: number) {
  const pool = limitedPool(max);
  const lock = await pool.connect();
  const backend = new AuthorizedPostgresBackend({
    pool,
    verify: async () => {
      const bound = await pool.connect();
      bound.release();
      return true;
    },
    profile: async () => null,
    returnTask: async () => null,
    project: async () => null,
    exchange: async () => null,
  });
  const authorization: RuntimeAuthorization = {
    caller: {
      hub: 'move', browserBinding: 'a'.repeat(43), environment: 'isolated', scopes: ['saved:write'],
      parent: { subject: '11111111-1111-4111-8111-111111111111', sessionBinding: 'b'.repeat(43), admitted: true },
    },
    operation: 'getProfileSaveReceipt',
    input: { accountContextRef: 'c'.repeat(43), requestKey: 'internal-context-resume' },
  };
  try {
    await backend.transaction(async () => false, authorization);
  } finally {
    lock.release();
  }
}

test('two pooled connections time out the closing session bind during confirm', async () => {
  await assert.rejects(resumeWhileConfirmationLocked(2), /timeout exceeded when trying to connect/);
});

test('the runtime pool covers the confirmation lock, transaction, and closing session bind', async () => {
  assert.equal(RUNTIME_POOL_MAX, 3);
  await resumeWhileConfirmationLocked(RUNTIME_POOL_MAX);
});
