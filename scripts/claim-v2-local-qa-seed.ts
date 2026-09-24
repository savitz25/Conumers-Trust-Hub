/**
 * ATH-CLAIM-V2-001 — LOCAL synthetic QA stack seed. NEVER points at production.
 *
 * Usage (see docs/claim-v2/ATH-CLAIM-V2-001-CONTRACT.md, "Local browser QA"):
 *   ASK_QA_DATABASE_URL=postgres://postgres@127.0.0.1:5433/ask_qa \
 *   CTH_QA_DATABASE_URL=postgres://postgres@127.0.0.1:5433/cth_qa \
 *   ATH_HANDOFF_SECRET=<synthetic 32+ chars> node --experimental-strip-types scripts/claim-v2-local-qa-seed.ts
 *
 * Refuses to run unless both URLs point at 127.0.0.1 / localhost. Everything it creates is labelled
 * internal_test / synthetic. It prints magic-link URLs for a synthetic staff account and a synthetic owner so
 * the browser can sign in without any real email being sent.
 */
import { Client } from 'pg';
import { applyCustomerMigrations, enableAppRole } from '../lib/customer/migrate.ts';
import { CustomerPlatform } from '../lib/customer/store.ts';
import { mintHandoffToken } from '../lib/customer/handoff.ts';
import type { CthDirectory } from '../lib/customer/adapter.ts';
import type { CthProfileRecord } from '../lib/customer/types.ts';
import type { SqlClient } from '../lib/customer/sql.ts';

const ASK_URL = process.env.ASK_QA_DATABASE_URL || '';
const CTH_URL = process.env.CTH_QA_DATABASE_URL || '';
const SECRET = process.env.ATH_HANDOFF_SECRET || '';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
for (const url of [ASK_URL, CTH_URL]) if (!/^postgres(ql)?:\/\/[^@]*@?(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('refusing: QA seed only runs against 127.0.0.1/localhost');
if (SECRET.length < 32) throw new Error('ATH_HANDOFF_SECRET (synthetic) must be at least 32 characters');

const PROFILES: CthProfileRecord[] = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', slug: 'cbc900001-harbor-test-builders', displayName: 'Harbor Test Builders (synthetic)', isThin: false, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC900001', sourceSystem: 'fl_dbpr' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', slug: 'cgc900002-lantern-test-roofing', displayName: 'Lantern Test Roofing (synthetic)', isThin: false, homeState: 'FL', licenseState: 'FL', externalKey: 'CGC900002', sourceSystem: 'fl_dbpr' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000003', slug: 'cfc900003-meridian-test-plumbing', displayName: 'Meridian Test Plumbing (synthetic)', isThin: false, homeState: 'FL', licenseState: 'FL', externalKey: 'CFC900003', sourceSystem: 'fl_dbpr' },
  { id: 'aaaaaaaa-0000-4000-8000-000000000004', slug: 'cac900004-summit-test-hvac', displayName: 'Summit Test HVAC (synthetic)', isThin: false, homeState: 'FL', licenseState: 'FL', externalKey: 'CAC900004', sourceSystem: 'fl_dbpr' },
];
const extra = process.env.CTH_QA_EXTRA_PROFILE; // optional "id|slug|externalKey|displayName" of a real PUBLIC profile for cross-repo QA
if (extra) { const [id, slug, externalKey, displayName] = extra.split('|'); PROFILES.push({ id, slug, externalKey, displayName, isThin: false, homeState: 'FL', licenseState: 'FL', sourceSystem: 'fl_dbpr' }); }
const cth: CthDirectory = { async getById(id) { return PROFILES.find((p) => p.id === id) ?? null; } };

async function seedCth() {
  const c = new Client({ connectionString: CTH_URL }); await c.connect();
  await c.query(`CREATE TABLE IF NOT EXISTS contractors (id uuid PRIMARY KEY, slug text NOT NULL, display_name text NOT NULL, is_thin_profile boolean NOT NULL DEFAULT false, home_state text)`);
  await c.query(`CREATE TABLE IF NOT EXISTS licenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contractor_id uuid NOT NULL, state text, external_key text NOT NULL, source_system text NOT NULL, status_normalized text, last_seen_at timestamptz DEFAULT now())`);
  await c.query(`DELETE FROM licenses; DELETE FROM contractors;`);
  for (const p of PROFILES) {
    await c.query(`INSERT INTO contractors (id, slug, display_name, is_thin_profile, home_state) VALUES ($1,$2,$3,$4,$5)`, [p.id, p.slug, p.displayName, p.isThin, p.homeState]);
    await c.query(`INSERT INTO licenses (contractor_id, state, external_key, source_system, status_normalized) VALUES ($1,'FL',$2,'fl_dbpr','active')`, [p.id, p.externalKey]);
  }
  await c.end();
}

async function main() {
  await seedCth();
  const client = new Client({ connectionString: ASK_URL }); await client.connect();
  const sql: SqlClient = { query: async (text, params) => ({ rows: (await client.query(text, params ?? [])).rows }), exec: async (text) => { await client.query(text); } };
  await applyCustomerMigrations(sql);
  await client.query('BEGIN'); await enableAppRole(sql);
  const links: string[] = [];
  // Lifecycle mail requires the production origin as siteUrl (customer-emails.ts guard); printed links are rewritten to the local origin.
  const CANON = 'https://www.asktrusthub.com';
  const platform = new CustomerPlatform({ sql, cth, mailer: async (m) => { const url = m.text.match(/https?:\/\/\S+/)?.[0]; if (url) links.push(`${m.to} -> ${url.replace(CANON, SITE)}`); return { sent: true, preview: m.text }; }, handoffSecret: SECRET, staffEmails: ['staff@qa.local'], siteUrl: CANON });
  const signIn = async (email: string) => { const sent = await platform.requestMagicLink({ email, nextPath: '/manage' }); const token = decodeURIComponent(sent.preview?.match(/token=([^&\s]+)/)?.[1] ?? ''); return platform.consumeMagicLink(token); };

  // Staff (named admin) — session used by the seed only; the browser signs in with its own fresh link below.
  const staff = await signIn('staff@qa.local');
  await client.query(`INSERT INTO ath_admin_staff (user_id, role, status, created_by) VALUES ($1,'SUPER_ADMIN','ACTIVE',$1) ON CONFLICT DO NOTHING`, [staff.userId]);
  // Owner with an ACTIVE grant (authorized fixture) on profile 1 and a REVOKED grant on profile 2.
  const owner = await signIn('owner@qa.local');
  const ownerTwo = await signIn('other-owner@qa.local');
  const approve = async (profile: CthProfileRecord, user: { sessionToken: string }) => {
    const intent = await platform.confirmClaimIntent({ token: mintHandoffToken(SECRET, { nativeProfileId: profile.id, slug: profile.slug, externalKey: profile.externalKey }).token, receiptId: `seed-${profile.externalKey}-receipt`, acquisitionSource: 'internal_test' });
    const claim = await platform.submitClaim({ sessionToken: user.sessionToken, intentId: intent.intentId, relationshipType: 'owner', credentialAttestation: profile.externalKey, authorized: true });
    await platform.startReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId, evidenceReady: true });
    const decided = await platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', evidenceCodes: ['CORPORATE_OFFICER_MATCH', 'VERIFIED_PUBLIC_CALLBACK'], evidenceNote: 'Synthetic QA fixture: officer match and callback recorded for the local QA stack only.', internalRationale: 'Synthetic QA fixture for ATH-CLAIM-V2-001 browser QA. Not a real business.', claimantMessage: 'Synthetic QA approval for the local browser QA stack. Not a real decision.', reasonCategory: 'AUTHORITY_VERIFIED' });
    return { claim, grantId: decided.grantId! };
  };
  const authorized = await approve(PROFILES[0], owner);
  await platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILES[0].id, body: { version: 0, fields: { website: 'https://harbor-test-builders.example', description: 'Synthetic QA business description.' }, services: ['Roofing'], serviceAreas: ['Hillsborough County'], languages: ['English'], hours: [{ weekday: 1, closed: false, opensAt: '09:00', closesAt: '17:00' }] } });
  const revoked = await approve(PROFILES[1], owner);
  await platform.revokeGrant({ sessionToken: staff.sessionToken, grantId: revoked.grantId, reason: 'Synthetic QA fixture: revoked grant for the local browser QA stack (revocation behaviour).' });
  // Open claims for the staff queue: one fresh (WITHIN), one aged 6 days (OVER the 2-business-day target), one needs_info.
  const openFor = async (profile: CthProfileRecord, user: { sessionToken: string }, ageDays: number) => {
    const intent = await platform.confirmClaimIntent({ token: mintHandoffToken(SECRET, { nativeProfileId: profile.id, slug: profile.slug, externalKey: profile.externalKey }).token, receiptId: `seed-open-${profile.externalKey}`, acquisitionSource: 'internal_test' });
    const claim = await platform.submitClaim({ sessionToken: user.sessionToken, intentId: intent.intentId, relationshipType: 'officer', credentialAttestation: profile.externalKey, authorized: true });
    if (ageDays) await client.query(`UPDATE ath_claims SET created_at = now() - ($2 || ' days')::interval, submitted_at = now() - ($2 || ' days')::interval WHERE id=$1`, [claim.claimId, String(ageDays)]);
    return claim;
  };
  const aged = await openFor(PROFILES[2], ownerTwo, 6);
  const fresh = await openFor(PROFILES[3], ownerTwo, 0);
  await platform.staffDecide({ sessionToken: staff.sessionToken, claimId: fresh.claimId, decision: 'needs_info', evidenceCodes: ['CREDENTIAL_KNOWLEDGE'], evidenceNote: 'Synthetic QA fixture: only credential knowledge was available at first review.', internalRationale: 'Synthetic QA fixture: needs-information state for the staff queue.', claimantMessage: 'Please provide an independent authority document (synthetic QA message).', reasonCategory: 'AUTHORITY_EVIDENCE_MISSING' });
  await client.query('COMMIT');

  // Fresh, unconsumed sign-in links for the browser (printed, never emailed).
  links.length = 0;
  await platform.requestMagicLink({ email: 'staff@qa.local', nextPath: '/admin/operations/claims' });
  await platform.requestMagicLink({ email: 'owner@qa.local', nextPath: '/manage' });
  const handoff = mintHandoffToken(SECRET, { nativeProfileId: PROFILES[3].id, slug: PROFILES[3].slug, externalKey: PROFILES[3].externalKey });
  const handoffTwo = mintHandoffToken(SECRET, { nativeProfileId: PROFILES[2].id, slug: PROFILES[2].slug, externalKey: PROFILES[2].externalKey });
  console.log(JSON.stringify({ seeded: true, authorizedProfile: PROFILES[0].id, revokedProfile: PROFILES[1].id, agedClaim: aged.claimId, needsInfoClaim: fresh.claimId, authorizedClaim: authorized.claim.claimId, signIn: links, claimContinue: `${SITE}/claim/continue?handoff=${encodeURIComponent(handoff.token)}&source=internal_test`, claimContinueTwo: `${SITE}/claim/continue?handoff=${encodeURIComponent(handoffTwo.token)}&source=internal_test` }, null, 2));
  await client.end();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
