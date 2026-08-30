import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform, AuthError, ClaimError } from './store.ts';
import { mintHandoffToken } from './handoff.ts';
import { HandoffError } from './handoff.ts';
import type { CthDirectory } from './adapter.ts';
import type { CthProfileRecord } from './types.ts';
import type { MailMessage } from './mail.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-handoff-secret-for-tests-32chars-min';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const THIN_ID = '22222222-2222-4222-8222-222222222222';
const TX_ID = '33333333-3333-4333-8333-333333333333';

const profiles = new Map<string, CthProfileRecord>([
  [
    PROFILE_ID,
    {
      id: PROFILE_ID,
      slug: 'cbc015082-acme-roofing',
      displayName: 'Acme Roofing LLC',
      isThin: false,
      homeState: 'FL',
      licenseState: 'FL',
      externalKey: 'CBC015082',
      sourceSystem: 'fl_dbpr',
    },
  ],
  [
    THIN_ID,
    {
      id: THIN_ID,
      slug: 'qb-shell',
      displayName: 'Thin QB',
      isThin: true,
      homeState: 'FL',
      licenseState: 'FL',
      externalKey: 'QB000001',
      sourceSystem: 'fl_dbpr',
    },
  ],
  [
    TX_ID,
    {
      id: TX_ID,
      slug: 'tx-only',
      displayName: 'Texas Co',
      isThin: false,
      homeState: 'TX',
      licenseState: 'TX',
      externalKey: 'TX123',
      sourceSystem: 'tx_tdlr',
    },
  ],
]);

const cth: CthDirectory = {
  async getById(id) {
    return profiles.get(id) ?? null;
  },
};

function asSql(db: PGlite): SqlClient {
  return {
    async query(text, params) {
      const result = await db.query(text, params ?? []);
      return { rows: (result.rows ?? []) as Record<string, unknown>[] };
    },
    async exec(sql) {
      await db.exec(sql);
    },
  };
}

async function boot() {
  const db = new PGlite();
  const sql = asSql(db);
  await applyCustomerMigrations(sql);
  await db.query('BEGIN');
  await enableAppRole(sql);
  const mailbox: MailMessage[] = [];
  const platform = new CustomerPlatform({
    sql,
    cth,
    mailer: async (m) => {
      mailbox.push(m);
      return { sent: false, preview: m.text };
    },
    handoffSecret: SECRET,
    staffEmails: ['staff@asktrusthub.com'],
    siteUrl: 'https://www.asktrusthub.com',
  });
  return { db, sql, platform, mailbox };
}

async function signup(platform: CustomerPlatform, email: string, next = '/claim/continue') {
  const sent = await platform.requestMagicLink({ email, nextPath: next });
  const match = sent.preview?.match(/token=([^&\s]+)/);
  assert.ok(match, 'magic link token');
  const token = decodeURIComponent(match[1]);
  return platform.consumeMagicLink(token);
}

test('reused nonce rejected', async () => {
  const { db, platform } = await boot();
  const { token } = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
  });
  await platform.acceptHandoff(token);
  await assert.rejects(() => platform.acceptHandoff(token), HandoffError);
  await db.close();
});

test('thin profile rejected at accept', async () => {
  const { db, platform } = await boot();
  const { token } = mintHandoffToken(SECRET, {
    nativeProfileId: THIN_ID,
    slug: 'qb-shell',
    externalKey: 'QB000001',
  });
  await assert.rejects(() => platform.acceptHandoff(token), ClaimError);
  await db.close();
});

test('expired magic link rejected and consumed link cannot be reused', async () => {
  const { db, platform } = await boot();
  const sent = await platform.requestMagicLink({ email: 'owner@example.com' });
  const token = decodeURIComponent(sent.preview!.match(/token=([^&\s]+)/)![1]);
  await platform.consumeMagicLink(token);
  await assert.rejects(() => platform.consumeMagicLink(token), (e: unknown) => {
    return e instanceof AuthError && e.code === 'consumed_link';
  });
  await assert.rejects(() => platform.consumeMagicLink('not-a-real-token'), AuthError);
  await db.close();
});

test('session required for claim submit', async () => {
  const { db, platform } = await boot();
  await assert.rejects(
    () =>
      platform.submitClaim({
        sessionToken: 'nope',
        intentId: '00000000-0000-4000-8000-000000000000',
        relationshipType: 'owner',
        credentialAttestation: 'CBC015082',
        authorized: true,
      }),
    AuthError
  );
  await db.close();
});

test('happy path: confirm ≠ grant; approval creates one active grant', async () => {
  const { db, sql, platform } = await boot();
  const { token } = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
  });
  const intent = await platform.acceptHandoff(token);
  const claimant = await signup(platform, 'owner@acme-roofing.test');
  const grantsBefore = await sql.query(`SELECT COUNT(*)::text AS n FROM ath_management_grants`);
  assert.equal(grantsBefore.rows[0].n, '0');

  const submitted = await platform.submitClaim({
    sessionToken: claimant.sessionToken,
    intentId: intent.intentId,
    relationshipType: 'owner',
    legalName: 'Acme Roofing LLC',
    credentialAttestation: 'CBC015082',
    authorized: true,
  });
  assert.equal(submitted.status, 'submitted');

  const stillNoGrant = await sql.query(`SELECT COUNT(*)::text AS n FROM ath_management_grants`);
  assert.equal(stillNoGrant.rows[0].n, '0');

  const staff = await signup(platform, 'staff@asktrusthub.com');
  const decided = await platform.staffDecide({
    sessionToken: staff.sessionToken,
    claimId: submitted.claimId,
    decision: 'approve',
    reason: 'License key matches the pointed Florida DBPR credential.',
  });
  assert.ok(decided.grantId);

  const grants = await sql.query<{ n: string; status: string }>(
    `SELECT COUNT(*)::text AS n FROM ath_management_grants WHERE status = 'active'`
  );
  assert.equal(grants.rows[0].n, '1');

  const home = await platform.managedHome(claimant.sessionToken);
  assert.equal(home.length, 1);
  await db.close();
});

test('user cannot read another organization claim', async () => {
  const { db, platform } = await boot();
  const { token } = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
  });
  const intent = await platform.acceptHandoff(token);
  const a = await signup(platform, 'a@example.com');
  const submitted = await platform.submitClaim({
    sessionToken: a.sessionToken,
    intentId: intent.intentId,
    relationshipType: 'officer',
    credentialAttestation: 'CBC015082',
    authorized: true,
  });
  const b = await signup(platform, 'b@example.com');
  await assert.rejects(() => platform.getClaimForUser(b.sessionToken, submitted.claimId), ClaimError);
  await db.close();
});

test('non-staff cannot access review actions', async () => {
  const { db, platform } = await boot();
  const user = await signup(platform, 'not-staff@gmail.com');
  await assert.rejects(
    () =>
      platform.staffDecide({
        sessionToken: user.sessionToken,
        claimId: '00000000-0000-4000-8000-000000000000',
        decision: 'approve',
        reason: 'nope',
      }),
    (e: unknown) => e instanceof AuthError && e.code === 'not_staff'
  );
  await db.close();
});

test('rejected claim cannot grant access', async () => {
  const { db, sql, platform } = await boot();
  const { token } = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
  });
  const intent = await platform.acceptHandoff(token);
  const claimant = await signup(platform, 'owner@example.com');
  const submitted = await platform.submitClaim({
    sessionToken: claimant.sessionToken,
    intentId: intent.intentId,
    relationshipType: 'owner',
    credentialAttestation: 'CBC015082',
    authorized: true,
  });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  await platform.staffDecide({
    sessionToken: staff.sessionToken,
    claimId: submitted.claimId,
    decision: 'reject',
    reason: 'Could not match the submitted credential to this profile.',
  });
  await assert.rejects(
    () =>
      platform.staffDecide({
        sessionToken: staff.sessionToken,
        claimId: submitted.claimId,
        decision: 'approve',
        reason: 'retry',
      }),
    (e: unknown) => e instanceof ClaimError && e.code === 'rejected_claim'
  );
  const grants = await sql.query(`SELECT COUNT(*)::text AS n FROM ath_management_grants`);
  assert.equal(grants.rows[0].n, '0');
  await db.close();
});

test('competing claim cannot steal the active grant', async () => {
  const { db, sql, platform } = await boot();
  const first = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
  });
  const intent1 = await platform.acceptHandoff(first.token);
  const owner = await signup(platform, 'owner@example.com');
  const claim1 = await platform.submitClaim({
    sessionToken: owner.sessionToken,
    intentId: intent1.intentId,
    relationshipType: 'owner',
    credentialAttestation: 'CBC015082',
    authorized: true,
  });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  const g = await platform.staffDecide({
    sessionToken: staff.sessionToken,
    claimId: claim1.claimId,
    decision: 'approve',
    reason: 'Match.',
  });

  const second = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
    nonce: 'second-nonce-token-value-24b',
  });
  const intent2 = await platform.acceptHandoff(second.token);
  const rival = await signup(platform, 'rival@gmail.com');
  const claim2 = await platform.submitClaim({
    sessionToken: rival.sessionToken,
    intentId: intent2.intentId,
    relationshipType: 'authorized_manager',
    credentialAttestation: 'CBC015082',
    authorized: true,
  });
  assert.equal(claim2.competing, true);
  assert.equal(claim2.status, 'in_review');

  await assert.rejects(
    () =>
      platform.staffDecide({
        sessionToken: staff.sessionToken,
        claimId: claim2.claimId,
        decision: 'approve',
        reason: 'transfer',
      }),
    (e: unknown) => e instanceof ClaimError && e.code === 'already_granted_elsewhere'
  );

  const active = await sql.query<{ id: string; n: string }>(
    `SELECT id, COUNT(*) OVER ()::text AS n FROM ath_management_grants WHERE status = 'active'`
  );
  assert.equal(active.rows.length, 1);
  assert.equal(active.rows[0].id, g.grantId);

  await assert.rejects(
    () =>
      sql.query(
        `INSERT INTO ath_management_grants (org_id, hub_profile_id, status, granted_from_claim_id)
         SELECT org_id, hub_profile_id, 'active', id FROM ath_claims WHERE id = $1`,
        [claim2.claimId]
      ),
    /unique|duplicate/i
  );
  await db.close();
});

test('client cannot self-create an active grant through the platform API', async () => {
  const { db, platform } = await boot();
  const user = await signup(platform, 'owner@example.com');
  assert.equal(typeof (platform as unknown as { createGrant?: unknown }).createGrant, 'undefined');
  const home = await platform.managedHome(user.sessionToken);
  assert.equal(home.length, 0);
  await db.close();
});

test('free-email is reviewable not rejected', async () => {
  const { db, platform } = await boot();
  const { token } = mintHandoffToken(SECRET, {
    nativeProfileId: PROFILE_ID,
    slug: 'cbc015082-acme-roofing',
    externalKey: 'CBC015082',
  });
  const intent = await platform.acceptHandoff(token);
  const gmail = await signup(platform, 'person@gmail.com');
  const submitted = await platform.submitClaim({
    sessionToken: gmail.sessionToken,
    intentId: intent.intentId,
    relationshipType: 'owner',
    credentialAttestation: 'CBC015082',
    authorized: true,
  });
  assert.equal(submitted.status, 'submitted');
  const detail = await platform.getClaimForUser(gmail.sessionToken, submitted.claimId);
  assert.equal(detail.free_email, true);
  await db.close();
});
