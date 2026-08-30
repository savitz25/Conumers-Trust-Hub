import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform, ManagementError } from './store.ts';
import { BusinessProfileValidationError, validateBusinessProfile } from './business-profile.ts';
import { businessFreshness } from './freshness.ts';
import type { SqlClient } from './sql.ts';

const PROFILE = '11111111-1111-4111-8111-111111111111';
const SIBLING = '22222222-2222-4222-8222-222222222222';

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email }); const token = decodeURIComponent(sent.preview!.match(/token=([^&\s]+)/)![1]); return platform.consumeMagicLink(token); }
async function boot() {
  const db = new PGlite(); const sql = asSql(db); await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const platform = new CustomerPlatform({ sql, cth: { async getById() { return null; } }, mailer: async (m) => ({ sent: false, preview: m.text }), handoffSecret: 'test-secret-that-is-long-enough-123', staffEmails: [], siteUrl: 'https://www.asktrusthub.com' });
  return { db, sql, platform };
}
async function grant(sql: SqlClient, platform: CustomerPlatform, email: string, role: 'owner'|'manager'|'staff'|'billing' = 'owner', profile = PROFILE) {
  const auth = await signup(platform, email);
  const org = (await sql.query<{id:string}>(`INSERT INTO ath_organizations(display_name,status) VALUES('Test org','active') RETURNING id`)).rows[0];
  await sql.query(`INSERT INTO ath_memberships(org_id,user_id,role,status) VALUES($1,$2,$3,'active')`, [org.id, auth.userId, role]);
  const hub = (await sql.query<{id:string}>(`INSERT INTO ath_hub_profiles(hub_id,native_profile_id,native_slug,native_credential_key,native_source_system,home_state,display_name_snapshot) VALUES('contractor',$1,'test-contractor','CBC123','fl_dbpr','FL','Test Contractor') RETURNING id`, [profile])).rows[0];
  const claim = (await sql.query<{id:string}>(`INSERT INTO ath_claims(org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email) VALUES($1,$2,$3,'approved','manual_review','owner',false) RETURNING id`, [org.id, hub.id, auth.userId])).rows[0];
  const g = (await sql.query<{id:string}>(`INSERT INTO ath_management_grants(org_id,hub_profile_id,status,granted_from_claim_id) VALUES($1,$2,'active',$3) RETURNING id`, [org.id, hub.id, claim.id])).rows[0];
  return { ...auth, orgId: org.id, hubId: hub.id, grantId: g.id };
}
const valid = { version: 0, fields: { description: 'Family-owned roofing contractor.', website: 'https://example.com', public_phone: '(555) 555-1212', public_email: 'office@example.com', founded_year: '2005', emergency_service: 'true', contact_context: 'Call weekdays.' }, services: ['Roofing'], serviceAreas: ['Orange County'], languages: ['English'], hours: [{ weekday: 1, closed: false, opensAt: '09:00', closesAt: '17:00' }] };

test('authorized owner persists normalized Layer C provenance, audit, and optimistic version', async () => {
  const { db, sql, platform } = await boot(); const owner = await grant(sql, platform, 'owner@example.com');
  const saved = await platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, body: valid }); assert.equal(saved.version, 1);
  const view = await platform.businessProfile(owner.sessionToken, PROFILE); assert.equal(view.fields.find((f) => f.field_key === 'description')?.source, 'BUSINESS_SUPPLIED'); assert.equal(view.items[0].supplied_by_user_id, owner.userId); assert.equal(view.activity[0].action, 'business_info_saved');
  await assert.rejects(() => platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, body: valid }), (e: unknown) => e instanceof ManagementError && e.code === 'stale_version');
  await db.close();
});

test('manager and staff edit; billing member cannot edit', async () => {
  for (const role of ['manager','staff'] as const) { const { db, sql, platform } = await boot(); const u = await grant(sql, platform, `${role}@example.com`, role); await platform.saveBusinessProfile({ sessionToken: u.sessionToken, nativeProfileId: PROFILE, body: valid }); await db.close(); }
  const { db, sql, platform } = await boot(); const billing = await grant(sql, platform, 'billing@example.com', 'billing');
  await platform.businessProfile(billing.sessionToken, PROFILE);
  await assert.rejects(() => platform.saveBusinessProfile({ sessionToken: billing.sessionToken, nativeProfileId: PROFILE, body: valid }), ManagementError); await db.close();
});

test('cross-org, sibling UUID, revoked grant, and inactive membership fail closed', async () => {
  const { db, sql, platform } = await boot(); const owner = await grant(sql, platform, 'owner@example.com'); const stranger = await signup(platform, 'stranger@example.com');
  await assert.rejects(() => platform.businessProfile(stranger.sessionToken, PROFILE), ManagementError);
  await assert.rejects(() => platform.businessProfile(owner.sessionToken, SIBLING), ManagementError);
  await sql.query(`UPDATE ath_management_grants SET status='revoked' WHERE id=$1`, [owner.grantId]);
  await assert.rejects(() => platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, body: valid }), ManagementError);
  await sql.query(`UPDATE ath_management_grants SET status='active' WHERE id=$1`, [owner.grantId]); await sql.query(`UPDATE ath_memberships SET status='revoked' WHERE org_id=$1`, [owner.orgId]);
  await assert.rejects(() => platform.businessProfile(owner.sessionToken, PROFILE), ManagementError); await db.close();
});

test('validation rejects HTML, javascript URLs, malformed contacts, giant lists, and unknown fields', () => {
  for (const fields of [{ description: '<script>alert(1)</script>' }, { website: 'javascript:alert(1)' }, { public_email: 'bad' }, { public_phone: 'not-a-phone' }, { surprise: 'x' }]) {
    assert.throws(() => validateBusinessProfile({ ...valid, fields }), BusinessProfileValidationError);
  }
  assert.throws(() => validateBusinessProfile({ ...valid, services: Array(31).fill('x') }), BusinessProfileValidationError);
});

test('new Layer C tables retain FORCE RLS and no evidence table is part of the migration', async () => {
  const { db, sql } = await boot(); const rows = await sql.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname LIKE 'ath_business_profile_%' AND relkind='r'`);
  assert.ok(rows.rows.length >= 4); for (const row of rows.rows) { assert.equal(row.relrowsecurity, true); assert.equal(row.relforcerowsecurity, true); }
  const migration = readFileSync('schema/migrations/002_ath_business_profile.sql', 'utf8');
  assert.doesNotMatch(migration, /\b(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:contractors|licenses|discipline_actions|regulatory_source_observations)\b/i);
  await db.close();
});

test('public contract is allowlisted and requires active exact-profile management', async () => {
  const { db, sql, platform } = await boot(); const owner = await grant(sql, platform, 'owner@example.com');
  await platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, body: valid });
  const publicProfile = await platform.publicBusinessProfile(PROFILE);
  assert.equal(publicProfile?.managed, true); assert.equal(publicProfile?.nativeProfileId, PROFILE);
  assert.equal(publicProfile?.fields.description, valid.fields.description); assert.deepEqual(publicProfile?.services, ['Roofing']);
  const serialized = JSON.stringify(publicProfile);
  for (const privateKey of ['orgId','org_id','userId','user_id','grantId','claim','audit']) {
    assert.equal(serialized.includes(privateKey), false, `public contract leaked ${privateKey}`);
  }
  await sql.query(`UPDATE ath_management_grants SET status='revoked' WHERE id=$1`, [owner.grantId]);
  assert.equal(await platform.publicBusinessProfile(PROFILE), null);
  await sql.query(`UPDATE ath_management_grants SET status='active' WHERE id=$1`, [owner.grantId]);
  await sql.query(`UPDATE ath_memberships SET status='revoked' WHERE org_id=$1`, [owner.orgId]);
  assert.equal(await platform.publicBusinessProfile(PROFILE), null);
  await db.close();
});

test('freshness thresholds are deterministic and never call content verified', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  assert.equal(businessFreshness(daysAgo(180), now).state, 'CURRENT');
  assert.equal(businessFreshness(daysAgo(181), now).state, 'RECONFIRM_SOON');
  assert.equal(businessFreshness(daysAgo(330), now).state, 'RECONFIRM_SOON');
  const stale = businessFreshness(daysAgo(331), now);
  assert.equal(stale.state, 'STALE'); assert.equal(stale.mayBeOutdated, true); assert.doesNotMatch(stale.label, /verif/i);
});

test('reconfirmation preserves values, requires current version, and writes durable audit', async () => {
  const { db, sql, platform } = await boot(); const owner = await grant(sql, platform, 'owner@example.com');
  const saved = await platform.saveBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, body: valid });
  const before = await platform.businessProfile(owner.sessionToken, PROFILE);
  const result = await platform.reconfirmBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, version: saved.version });
  assert.equal(result.version, 2); assert.equal(result.freshness.state, 'CURRENT');
  const after = await platform.businessProfile(owner.sessionToken, PROFILE);
  assert.deepEqual(after.fields.map((row) => [row.field_key, row.value_text]), before.fields.map((row) => [row.field_key, row.value_text]));
  assert.ok(after.activity.some((event) => event.action === 'business_info_reconfirmed'));
  await assert.rejects(() => platform.reconfirmBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, version: 1 }), (e: unknown) => e instanceof ManagementError && e.code === 'stale_version');
  await sql.query(`UPDATE ath_management_grants SET status='revoked' WHERE id=$1`, [owner.grantId]);
  await assert.rejects(() => platform.reconfirmBusinessProfile({ sessionToken: owner.sessionToken, nativeProfileId: PROFILE, version: 2 }), ManagementError);
  await db.close();
});
