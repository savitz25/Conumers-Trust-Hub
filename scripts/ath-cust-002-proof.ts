/**
 * Controlled ATH-CUST-002 proof: Ask customer plane + read-only CTH validation.
 * Revokes the grant afterward so a real firm is not left “managed” by a test account.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { loadEnvFile } from './load-env.mjs';
import { applyCustomerMigrations, enableAppRole } from '../lib/customer/migrate.ts';
import { CustomerPlatform } from '../lib/customer/store.ts';
import { mintHandoffToken } from '../lib/customer/handoff.ts';
import { randomToken } from '../lib/customer/crypto.ts';
import type { CthDirectory } from '../lib/customer/adapter.ts';
import type { SqlClient } from '../lib/customer/sql.ts';
import { LAYER_A_FINGERPRINT_SQL } from '../lib/customer/layer-a.ts';

loadEnvFile(join(process.cwd(), '.env.local'));
loadEnvFile(join('C:/Users/makei/contractor-trust-hub/.env.local'));

if (!process.env.ATH_HANDOFF_SECRET) {
  process.env.ATH_HANDOFF_SECRET = randomToken(32);
}
process.env.ATH_STAFF_EMAILS ||= 'ath-cust-002-staff@asktrusthub.com';
process.env.NEXT_PUBLIC_SITE_URL ||= 'https://www.asktrusthub.com';

const cthUrl = process.env.CTH_READ_DATABASE_URL || process.env.DATABASE_URL;
if (!cthUrl) {
  console.error('CTH_READ_DATABASE_URL (or CTH DATABASE_URL) required for source-of-truth validation.');
  process.exit(1);
}

function pgliteSql(db: PGlite): SqlClient {
  return {
    async query(text, params) {
      const res = await db.query(text, params ?? []);
      return { rows: (res.rows ?? []) as Record<string, unknown>[] };
    },
    async exec(sql) {
      await db.exec(sql);
    },
  };
}

const cthPool = new Pool({
  connectionString: cthUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const fpBefore = await cthPool.query(LAYER_A_FINGERPRINT_SQL);
const profileRes = await cthPool.query<{
  id: string;
  slug: string;
  display_name: string;
  is_thin_profile: boolean;
  home_state: string | null;
  license_state: string | null;
  external_key: string;
  source_system: string;
}>(
  `SELECT c.id::text AS id, c.slug, c.display_name, c.is_thin_profile, c.home_state,
          l.state AS license_state, l.external_key, l.source_system
     FROM contractors c
     JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
    WHERE c.home_state = 'FL' AND c.is_thin_profile IS FALSE AND c.slug IS NOT NULL
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT 1`
);
const row = profileRes.rows[0];
if (!row) {
  console.error('No Florida non-thin fl_dbpr profile found.');
  process.exit(1);
}

const cth: CthDirectory = {
  async getById(id: string) {
    const res = await cthPool.query(
      `SELECT c.id::text AS id, c.slug, c.display_name, c.is_thin_profile, c.home_state,
              l.state AS license_state, l.external_key, l.source_system
         FROM contractors c
         JOIN licenses l ON l.contractor_id = c.id AND l.source_system = 'fl_dbpr'
        WHERE c.id = $1::uuid
        LIMIT 1`,
      [id]
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      slug: r.slug,
      displayName: r.display_name,
      isThin: Boolean(r.is_thin_profile),
      homeState: r.home_state,
      licenseState: r.license_state,
      externalKey: r.external_key,
      sourceSystem: r.source_system,
    };
  },
};

const askUrl = process.env.ASK_DATABASE_URL;
let sql: SqlClient;
let closeAsk: () => Promise<void> = async () => {};
let askKind = 'pglite';

if (askUrl) {
  askKind = 'postgres';
  const askPool = new Pool({
    connectionString: askUrl,
    ssl: /supabase|neon|sslmode=require|pooler/i.test(askUrl)
      ? { rejectUnauthorized: false }
      : undefined,
    max: 1,
  });
  const client = await askPool.connect();
  await client.query('BEGIN');
  await client.query("SELECT set_config('ath.app_role', 'server', true)");
  const txSql: SqlClient = {
    query: (text, params) => client.query(text, params).then((r) => ({ rows: r.rows })),
  };
  await applyCustomerMigrations(txSql);
  sql = txSql;
  closeAsk = async () => {
    await client.query('COMMIT');
    client.release();
    await askPool.end();
  };
} else {
  const db = new PGlite();
  sql = pgliteSql(db);
  await applyCustomerMigrations(sql);
  await db.query('BEGIN');
  await enableAppRole(sql);
  closeAsk = async () => {
    await db.query('COMMIT');
    await db.close();
  };
}

const mailbox: string[] = [];
const platform = new CustomerPlatform({
  sql,
  cth,
  mailer: async (m) => {
    mailbox.push(m.subject);
    return { sent: false, preview: m.text };
  },
  handoffSecret: process.env.ATH_HANDOFF_SECRET,
  staffEmails: ['ath-cust-002-staff@asktrusthub.com'],
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.asktrusthub.com',
});

const minted = mintHandoffToken(process.env.ATH_HANDOFF_SECRET, {
  nativeProfileId: row.id,
  slug: row.slug,
  externalKey: row.external_key,
});
const accepted = await platform.acceptHandoff(minted.token);
const claimantMail = await platform.requestMagicLink({
  email: 'ath-cust-002-proof@asktrusthub.com',
  nextPath: '/claim/continue',
});
const claimantToken = decodeURIComponent(claimantMail.preview!.match(/token=([^&\s]+)/)![1]);
const claimant = await platform.consumeMagicLink(claimantToken);
const submitted = await platform.submitClaim({
  sessionToken: claimant.sessionToken,
  intentId: accepted.intentId,
  relationshipType: 'owner',
  legalName: 'ATH-CUST-002 Controlled Test Org',
  credentialAttestation: row.external_key,
  authorized: true,
});
const staffMail = await platform.requestMagicLink({ email: 'ath-cust-002-staff@asktrusthub.com' });
const staffToken = decodeURIComponent(staffMail.preview!.match(/token=([^&\s]+)/)![1]);
const staff = await platform.consumeMagicLink(staffToken);
const decided = await platform.staffDecide({
  sessionToken: staff.sessionToken,
  claimId: submitted.claimId,
  decision: 'approve',
  reason: 'Controlled ATH-CUST-002 proof. License key matches the pointed Florida profile.',
});

const active = await sql.query<{ n: string }>(
  `SELECT COUNT(*)::text AS n FROM ath_management_grants WHERE status = 'active'`
);
const audits = await sql.query<{ n: string }>(
  `SELECT COUNT(*)::text AS n FROM ath_audit_events`
);

await platform.revokeGrant({
  sessionToken: staff.sessionToken,
  grantId: decided.grantId!,
  reason: 'ATH-CUST-002 proof hygiene — do not leave a real firm managed by a test account.',
});

const fpAfter = await cthPool.query(LAYER_A_FINGERPRINT_SQL);
await cthPool.end();
await closeAsk();

const layerUnchanged = JSON.stringify(fpBefore.rows[0]) === JSON.stringify(fpAfter.rows[0]);

const proof = {
  ask_db: askKind,
  contractor_uuid: row.id,
  slug: row.slug,
  dbpr_external_key: row.external_key,
  display_name: row.display_name,
  claim_id: submitted.claimId,
  organization_id: submitted.orgId,
  management_grant_id: decided.grantId,
  grant_revoked_after_proof: true,
  active_grants_at_approval: active.rows[0]?.n,
  audit_event_count: audits.rows[0]?.n,
  mailbox_subjects: mailbox,
  layer_a_unchanged: layerUnchanged,
  fingerprint_before: fpBefore.rows[0],
  fingerprint_after: fpAfter.rows[0],
};

mkdirSync(join(process.cwd(), 'data'), { recursive: true });
writeFileSync(join(process.cwd(), 'data/ath-cust-002-proof.json'), JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
if (!layerUnchanged) {
  console.error('LAYER A CHANGED');
  process.exit(1);
}
if (active.rows[0]?.n !== '1') {
  console.error('expected one active grant at approval');
  process.exit(1);
}
