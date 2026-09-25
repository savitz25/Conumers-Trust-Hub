import 'server-only';
import { Pool } from 'pg';
import { assertReadOnlyCthSql } from './layer-a';
import type { CthDirectory } from './adapter';
import type { CthProfileRecord } from './types';
import { selectCthCredential, type CthCredentialRow } from './cth-credential-select';
import { customerLog } from './log';

let pool: Pool | null = null;

/**
 * ATH-CLAIM-V2-FLNJ-001: returns every claimable-source credential row for the profile (FL fl_dbpr, NJ nj_dca) in
 * the same order Contractor's loadEligibleClaimProfile uses. The caller picks the credential the signed handoff
 * names (exact source + key) so Ask re-reads and verifies the specialist's own row; without a hint the FL-first
 * deterministic selection applies. Research-only sources (nj_sos, nj_enforcement, permits, out-of-state
 * credentials) never qualify.
 */
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
  JOIN licenses l ON l.contractor_id = c.id AND l.source_system IN ('fl_dbpr', 'nj_dca')
                  AND NULLIF(TRIM(l.external_key), '') IS NOT NULL
 WHERE c.id = $1::uuid
 ORDER BY CASE WHEN l.source_system = 'fl_dbpr' THEN 0 ELSE 1 END,
          CASE WHEN l.status_normalized = 'active' THEN 0 ELSE 1 END,
          l.last_seen_at DESC NULLS LAST,
          l.external_key ASC
 LIMIT 50
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
  async getById(id: string, credential?: { sourceSystem: string; externalKey: string }): Promise<CthProfileRecord | null> {
    assertReadOnlyCthSql(PROFILE_SQL);
    try {
      const res = await getPool().query(PROFILE_SQL, [id]);
      const row = selectCthCredential(res.rows as CthCredentialRow[], credential);
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
