import 'server-only';
import { Pool } from 'pg';
import { assertReadOnlyCthSql } from './layer-a';
import type { CthDirectory } from './adapter';
import type { CthProfileRecord } from './types';
import { customerLog } from './log';

let pool: Pool | null = null;

const PROFILE_SQL = `
SELECT c.id::text AS id,
       c.slug,
       c.display_name,
       c.is_thin_profile,
       c.home_state,
       l.state AS license_state,
       l.external_key,
       l.source_system
  FROM contractors c
  JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
 WHERE c.id = $1::uuid
 ORDER BY CASE WHEN l.status_normalized = 'active' THEN 0 ELSE 1 END,
          l.last_seen_at DESC NULLS LAST
 LIMIT 1
`;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.CTH_READ_DATABASE_URL;
  if (!connectionString) {
    throw new Error('CTH_READ_DATABASE_URL is not set (Ask server-only read adapter to ContractorTrustHub).');
  }
  const needsSsl =
    /supabase|neon|sslmode=require|pooler/i.test(connectionString) || process.env.PGSSLMODE === 'require';
  pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 12_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export const cthReadDirectory: CthDirectory = {
  async getById(id: string): Promise<CthProfileRecord | null> {
    assertReadOnlyCthSql(PROFILE_SQL);
    try {
      const res = await getPool().query(PROFILE_SQL, [id]);
      const row = res.rows[0] as
        | {
            id: string;
            slug: string;
            display_name: string;
            is_thin_profile: boolean;
            home_state: string | null;
            license_state: string | null;
            external_key: string;
            source_system: string;
          }
        | undefined;
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        displayName: row.display_name,
        isThin: Boolean(row.is_thin_profile),
        homeState: row.home_state,
        licenseState: row.license_state,
        externalKey: row.external_key,
        sourceSystem: row.source_system,
      };
    } catch (err) {
      customerLog('cth_read_failed', { message: err instanceof Error ? err.message : String(err) }, 'error');
      throw err;
    }
  },
};

export async function fingerprintLayerA(): Promise<Record<string, string>> {
  const { LAYER_A_FINGERPRINT_SQL, assertReadOnlyCthSql: check } = await import('./layer-a');
  check(LAYER_A_FINGERPRINT_SQL);
  const res = await getPool().query(LAYER_A_FINGERPRINT_SQL);
  const row = res.rows[0] as Record<string, string>;
  return {
    licenses: row.licenses,
    discipline: row.discipline,
    observations: row.observations,
    publicationEligible: row.publication_eligible,
    contractorsUpdated: row.contractors_updated,
  };
}
