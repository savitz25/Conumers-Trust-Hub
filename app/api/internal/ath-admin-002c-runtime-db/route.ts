import { NextResponse } from 'next/server';
import { readSessionToken, withPlatform } from '@/lib/customer/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CountRow = { count: string };

export async function GET() {
  const token = await readSessionToken();

  try {
    const diagnostic = await withPlatform(async (platform, sql) => {
      const user = await platform.sessionUser(token);
      if (!user) return null;

      const identity = await sql.query<{
        database_name: string;
        postgres_version: string;
        neon_project_id: string | null;
        neon_branch_id: string | null;
        admin_table: string | null;
      }>(`SELECT current_database() AS database_name,
                 current_setting('server_version') AS postgres_version,
                 NULLIF(current_setting('neon.project_id', true), '') AS neon_project_id,
                 NULLIF(current_setting('neon.branch_id', true), '') AS neon_branch_id,
                 to_regclass('public.ath_admin_staff')::text AS admin_table`);
      const users = await sql.query<CountRow>('SELECT count(*)::text AS count FROM ath_users');
      const sessions = await sql.query<CountRow>('SELECT count(*)::text AS count FROM ath_sessions');
      const row = identity.rows[0];
      let staff = 'NOT_PRESENT';
      if (row.admin_table) {
        staff = (await sql.query<CountRow>('SELECT count(*)::text AS count FROM ath_admin_staff')).rows[0]?.count ?? '0';
      }

      return {
        provider: 'Neon/Postgres',
        neonProjectId: row.neon_project_id,
        neonBranchId: row.neon_branch_id,
        database: row.database_name,
        postgresVersion: row.postgres_version,
        counts: {
          users: users.rows[0]?.count ?? '0',
          sessions: sessions.rows[0]?.count ?? '0',
          adminStaff: staff,
        },
        adminStaffTableExists: Boolean(row.admin_table),
      };
    });

    if (!diagnostic) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ ok: true, diagnostic }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'DIAGNOSTIC_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
