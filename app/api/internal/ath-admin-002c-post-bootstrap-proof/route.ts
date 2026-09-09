import { NextResponse } from 'next/server';
import { withAdminSecurity } from '@/lib/control-plane/server';
import { AdminAuthError } from '@/lib/control-plane/security';
import { withAskTx } from '@/lib/customer/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMMAND_ID = '002c002c-002c-402c-802c-002c002c002c';
const IDEMPOTENCY_KEY = 'ath-admin-002c-production-proof-v1';

export async function GET() {
  try {
    const command = await withAdminSecurity(async (service, token, ctx) => {
      const actor = await service.require(token, 'ADMIN_COMMAND_EXECUTE');
      if (actor.role !== 'SUPER_ADMIN') throw new AdminAuthError('FORBIDDEN');
      const value = {
        schema_version: 'admin_command.v1',
        command_id: COMMAND_ID,
        command_type: 'SEARCH_FEATURE_DISABLE',
        target_scope: { type: 'feature', ref: 'ath-admin-002c-proof' },
        actor: { type: 'STAFF_USER', ref: 'current-staff' },
        authorization_context: { role: 'SUPER_ADMIN', policy_version: 'admin-rbac.v1' },
        reason_code: 'PRODUCTION_ACTIVATION_PROOF',
        requested_at: '2026-09-09T00:00:00.000Z',
        before_state_ref: 'not-connected',
        intended_after_state: 'disabled',
        result: 'PENDING',
        audit_ref: 'ath-admin-002c-proof',
      } as const;
      const first = await service.submitCommand(token, value, IDEMPOTENCY_KEY, ctx);
      const second = await service.submitCommand(token, value, IDEMPOTENCY_KEY, ctx);
      return { first, second };
    });

    const databaseProof = await withAskTx(async (client) => {
      const summary = await client.query<{
        active_super_admins: number;
        bootstrap_events: number;
        command_rows: number;
        flag_exists: boolean;
        flag_enabled: boolean | null;
        flag_connection_state: string | null;
        flag_reason: string | null;
      }>(`SELECT
        (SELECT count(*)::int FROM ath_admin_staff WHERE role='SUPER_ADMIN' AND status='ACTIVE') active_super_admins,
        (SELECT count(*)::int FROM ath_admin_audit_log WHERE event_type='ADMIN_BOOTSTRAPPED') bootstrap_events,
        (SELECT count(*)::int FROM ath_admin_commands WHERE idempotency_key=$1) command_rows,
        EXISTS(SELECT 1 FROM ath_control_flags WHERE flag_key='SEARCH_FEATURE_DISABLED' AND scope_key='feature:ath-admin-002c-proof') flag_exists,
        (SELECT enabled FROM ath_control_flags WHERE flag_key='SEARCH_FEATURE_DISABLED' AND scope_key='feature:ath-admin-002c-proof') flag_enabled,
        (SELECT connection_state FROM ath_control_flags WHERE flag_key='SEARCH_FEATURE_DISABLED' AND scope_key='feature:ath-admin-002c-proof') flag_connection_state,
        (SELECT reason_code FROM ath_control_flags WHERE flag_key='SEARCH_FEATURE_DISABLED' AND scope_key='feature:ath-admin-002c-proof') flag_reason`, [IDEMPOTENCY_KEY]);

      const audit = await client.query<{ audit_id: string }>('SELECT audit_id::text FROM ath_admin_audit_log ORDER BY occurred_at DESC LIMIT 1');
      if (!audit.rows[0]) throw new Error('Proof audit row unavailable');
      let updateRejected = false;
      let deleteRejected = false;
      await client.query('SAVEPOINT ath_002c_update');
      try {
        await client.query('UPDATE ath_admin_audit_log SET result=result WHERE audit_id=$1', [audit.rows[0].audit_id]);
      } catch (error) {
        updateRejected = /append-only/i.test(error instanceof Error ? error.message : String(error));
        await client.query('ROLLBACK TO SAVEPOINT ath_002c_update');
      }
      await client.query('RELEASE SAVEPOINT ath_002c_update');
      await client.query('SAVEPOINT ath_002c_delete');
      try {
        await client.query('DELETE FROM ath_admin_audit_log WHERE audit_id=$1', [audit.rows[0].audit_id]);
      } catch (error) {
        deleteRejected = /append-only/i.test(error instanceof Error ? error.message : String(error));
        await client.query('ROLLBACK TO SAVEPOINT ath_002c_delete');
      }
      await client.query('RELEASE SAVEPOINT ath_002c_delete');
      return { ...summary.rows[0], updateRejected, deleteRejected };
    });

    const ok = databaseProof.active_super_admins === 1 &&
      databaseProof.bootstrap_events === 1 &&
      databaseProof.flag_exists && databaseProof.flag_enabled === false &&
      databaseProof.flag_connection_state === 'NOT_YET_CONNECTED' &&
      databaseProof.flag_reason === 'PRODUCTION_ACTIVATION_PROOF' &&
      databaseProof.command_rows === 1 &&
      command.first.status === 'REJECTED' && command.first.idempotentReplay === false &&
      command.second.status === 'REJECTED' && command.second.idempotentReplay === true &&
      databaseProof.updateRejected && databaseProof.deleteRejected;

    return NextResponse.json({
      ok,
      bootstrapClosed: databaseProof.active_super_admins === 1,
      activeSuperAdmins: databaseProof.active_super_admins,
      controlFlag: {
        exists: databaseProof.flag_exists,
        enabled: databaseProof.flag_enabled,
        connectionState: databaseProof.flag_connection_state,
      },
      command: {
        firstStatus: command.first.status,
        firstReplay: command.first.idempotentReplay,
        secondStatus: command.second.status,
        secondReplay: command.second.idempotentReplay,
        rowCount: databaseProof.command_rows,
      },
      auditImmutable: {
        updateRejected: databaseProof.updateRejected,
        deleteRejected: databaseProof.deleteRejected,
      },
    }, { status: ok ? 200 : 409, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof AdminAuthError && error.code === 'UNAUTHENTICATED' ? 401 :
      error instanceof AdminAuthError && (error.code === 'FORBIDDEN' || error.code === 'DISABLED') ? 403 : 503;
    return NextResponse.json({ ok: false, error: status === 503 ? 'PROOF_UNAVAILABLE' : error instanceof AdminAuthError ? error.code : 'PROOF_UNAVAILABLE' }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
