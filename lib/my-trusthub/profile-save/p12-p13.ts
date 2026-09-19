/** Existing foundation calls. The deployment binding must provide correctly
 * scoped transactional connections; this module never creates a pool, widens
 * permissions, sets a caller-selected JWT subject or accepts service-role keys.
 */
import type { VerifiedCaller } from './runtime.ts';
import { RuntimeError } from './runtime.ts';
export interface FoundationSql {
  query<T>(sql: string, values: unknown[]): Promise<{ rows: T[] }>;
}
export async function saveP12(sql: FoundationSql, bindingId: string, caller: VerifiedCaller) {
  const owner = await sql.query<{ subject: string }>('select consumer.require_user() as subject', []);
  if (!caller.parent?.admitted || owner.rows[0]?.subject !== caller.parent.subject) throw new RuntimeError('unauthorized');
  const r = await sql.query<{ saved_entity_id: string; created: boolean; restored: boolean }>(
    'select * from consumer.save_entity($1,$2,$3)', [bindingId, caller.hub, { purpose: 'v2_3_profile_save' }]);
  if (!r.rows[0]?.saved_entity_id) throw new RuntimeError('unavailable');
  return { savedRef: r.rows[0].saved_entity_id, created: r.rows[0].created, restored: r.rows[0].restored };
}
export async function addProjectP12(sql: FoundationSql, projectId: string, savedId: string) {
  await sql.query('savepoint v23_project', []);
  try {
    const r = await sql.query<{ added: boolean }>('select consumer.add_saved_entity_to_project($1,$2,null) as added', [projectId, savedId]);
    if (typeof r.rows[0]?.added !== 'boolean') throw new Error('No membership result');
    await sql.query('release savepoint v23_project', []);
    return r.rows[0].added ? 'added' as const : 'already_member' as const;
  } catch {
    await sql.query('rollback to savepoint v23_project', []);
    await sql.query('release savepoint v23_project', []);
    return 'failed' as const;
  }
}
export type P13Proof = { code: string; targetOrigin: string; state: string; nonce: string; rateBucket: string };
export async function consumeP13(sql: FoundationSql, proof: P13Proof, caller: VerifiedCaller) {
  const r = await sql.query<{ ok: boolean; canonical_user_id: string }>(
    'select * from ops.consume_consumer_auth_handoff($1,$2,$3,$4,$5,$6,$7)',
    [proof.code, caller.hub, 'ask', proof.targetOrigin, proof.state, proof.nonce, proof.rateBucket]);
  if (!r.rows[0]?.ok || !caller.parent?.admitted || r.rows[0].canonical_user_id !== caller.parent.subject)
    throw new RuntimeError('unauthorized');
  return { subject: r.rows[0].canonical_user_id };
}
