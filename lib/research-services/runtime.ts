import 'server-only';
import { customerLog } from '../customer/log';
import { withAskTx } from '../customer/db';
import type { SqlClient } from '../customer/sql';
import { createInquiryMailer } from './notify';
import type { SubmitDeps } from './submit';

export function researchInquiryDeps(env: NodeJS.ProcessEnv = process.env): SubmitDeps {
  return {
    transaction: (fn) => withAskTx(async (client) => fn(asSql(client))),
    mailer: createInquiryMailer(env),
    now: () => new Date(),
    secret: env.ATH_HANDOFF_SECRET || '',
    log: (event, fields) => {
      const level = fields.result === 'failed' || event.endsWith('unavailable') ? 'error' : 'info';
      customerLog(event, fields, level);
    },
  };
}

function asSql(client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): SqlClient {
  return {
    async query<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return { rows: result.rows as T[] };
    },
  };
}
