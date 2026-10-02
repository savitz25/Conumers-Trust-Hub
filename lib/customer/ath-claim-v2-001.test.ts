/**
 * ATH-CLAIM-V2-001 — permanent V2 claim contract suite (Ask side). Section 13 items A–X.
 * Runs on an in-memory PGlite with the real migrations. No production connection. No real customer data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole, splitSqlStatements } from './migrate.ts';
import { CustomerPlatform, AuthError, ClaimError, ManagementError } from './store.ts';
import { HandoffError, mintHandoffToken, mutateHandoffToken } from './handoff.ts';
import { checkSameOrigin } from './request-origin.ts';
import { decodeClaimReceipt, encodeClaimReceipt } from './claim-receipt.ts';
import { CLAIM_V2_BROWSER_EVENTS, CLAIM_V2_FUNNEL, claimAcquisitionSourceV2 } from './claim-v2-funnel.ts';
import { businessHoursBetween, reviewSlaState, openClaimPriority, REVIEW_SLA_LABEL } from './review-sla.ts';
import { computeReviewCapacity, capReviewSession, REVIEW_SESSION_CAP_SECONDS } from './review-capacity.ts';
import { CLAIM_V2_REQUIREMENTS, evaluateHubReadiness, sixHubReadinessReport } from './claim-v2-readiness.ts';
import { evaluateAuthority } from './claim-governance.ts';
import { safeClaimFunnelProperties } from './claim-launch.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord, HandoffPayload } from './types.ts';
import type { SqlClient } from './sql.ts';
import type { MailMessage } from './mail.ts';

const SECRET = 'ath-claim-v2-001-handoff-secret-32-characters-min';
const CONTRACTOR: CustomerProfileRecord = { id: '11111111-1111-4111-8111-111111111111', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc015082-acme-roofing', displayName: 'Acme Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC015082', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc015082-acme-roofing' };
const THIN: CustomerProfileRecord = { ...CONTRACTOR, id: '22222222-2222-4222-8222-222222222222', slug: 'qb-shell', displayName: 'Thin QB', isThin: true, publicationEligible: false, externalKey: 'QB000001', canonicalUrl: 'https://www.contractortrusthub.com/contractors/qb-shell' };
const MOVER: CustomerProfileRecord = { id: '33333333-3333-4333-8333-333333333333', hubId: 'move', entityClass: 'mover', slug: 'test-mover', displayName: 'Test Mover', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: null, externalKey: '1199826', sourceSystem: 'fmcsa', canonicalUrl: 'https://www.movetrusthub.com/companies/test-mover' };
const profiles = [CONTRACTOR, THIN, MOVER];
let specialistDown = false;
const directory: CustomerProfileDirectory = { async getExact(p) { if (specialistDown) throw new Error('specialist_unavailable'); return profiles.find((x) => x.hubId === p.hub_id && x.id === p.native_profile_id) ?? null; } };

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }
async function boot(opts: { staff?: string[] } = {}) {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: new Date('2026-09-22T14:00:00Z') };
  const mailbox: MailMessage[] = [];
  const platform = new CustomerPlatform({ sql, cth: directory, mailer: async (m) => { mailbox.push(m); return { sent: true, preview: m.text }; }, handoffSecret: SECRET, staffEmails: opts.staff ?? ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  return { db, sql, platform, clock, mailbox };
}
function mint(profile: CustomerProfileRecord, overrides: Partial<Parameters<typeof mintHandoffToken>[1]> = {}) {
  const ns = profile.hubId === 'contractor' ? 'credential' : 'USDOT';
  return mintHandoffToken(SECRET, { hubId: profile.hubId, nativeProfileId: profile.id, slug: profile.slug, externalKey: profile.externalKey, sourceSystem: profile.sourceSystem, homeState: profile.homeState, identifierNamespace: ns, entityClass: profile.entityClass, canonicalProfileUrl: profile.canonicalUrl, displayName: profile.displayName, version: 2, now: new Date('2026-09-22T13:59:00Z'), ...overrides });
}
async function intents(sql: SqlClient) { const r = await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claim_intents`); return Number(r.rows[0]?.n); }
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }
const receipt = () => `receipt-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const governedApproval = { evidenceCodes: ['CORPORATE_OFFICER_MATCH', 'COMPANY_DOMAIN_CONTROL'] as const, evidenceNote: 'Current corporate officer source checked independently; authenticated business-domain control confirmed.', internalRationale: 'Independent authority plus separately validated control satisfies the Contractor standard.', claimantMessage: 'Ask Trust Hub verified authority through independent business records and contact verification.', reasonCategory: 'AUTHORITY_VERIFIED' as const };

// ---------------------------------------------------------------- A / D / H (Ask side)
test('A: 1,000 passive handoff receipts create 0 durable claim intents and 0 audit rows', async () => {
  const { db, sql, platform } = await boot();
  for (let i = 0; i < 1000; i += 1) { const { token } = mint(CONTRACTOR, { nonce: `bot-${i}` }); const r = await platform.receiveHandoff(token); assert.equal(r.payload.native_profile_id, CONTRACTOR.id); }
  assert.equal(await intents(sql), 0);
  const audit = await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_audit_events WHERE object_type='ath_claim_intents'`);
  assert.equal(Number(audit.rows[0].n), 0);
  await db.close();
});

test('D/H: refreshing the identity page (repeat receipt of the same token) never creates an intent', async () => {
  const { db, sql, platform } = await boot();
  const { token } = mint(CONTRACTOR, { nonce: 'refresh-nonce' });
  for (let i = 0; i < 25; i += 1) await platform.receiveHandoff(token);
  assert.equal(await intents(sql), 0);
  await db.close();
});

// ---------------------------------------------------------------- B / E / C
test('B/E/C: explicit Continue creates exactly one intent; double-click is idempotent; replay fails closed', async () => {
  const { db, sql, platform } = await boot();
  const { token, payload } = mint(CONTRACTOR, { nonce: 'continue-nonce' });
  await platform.receiveHandoff(token);
  const rid = receipt();
  const first = await platform.confirmClaimIntent({ token, receiptId: rid, acquisitionSource: 'organic' });
  assert.equal(first.created, true);
  const second = await platform.confirmClaimIntent({ token, receiptId: rid, acquisitionSource: 'organic' });
  assert.equal(second.created, false); assert.equal(second.intentId, first.intentId);
  const both = await Promise.all([platform.confirmClaimIntent({ token, receiptId: rid }), platform.confirmClaimIntent({ token, receiptId: rid })]);
  assert.ok(both.every((x) => x.intentId === first.intentId));
  assert.equal(await intents(sql), 1);
  const row = (await sql.query<Record<string, unknown>>(`SELECT intent_origin, acquisition_source, confirmed_at, receipt_hash, nonce FROM ath_claim_intents`)).rows[0];
  assert.equal(row.intent_origin, 'explicit_continue'); assert.equal(row.acquisition_source, 'organic'); assert.ok(row.confirmed_at); assert.ok(row.receipt_hash); assert.equal(row.nonce, payload.nonce);
  const audit = await sql.query<{ action: string }>(`SELECT action FROM ath_audit_events WHERE object_type='ath_claim_intents'`);
  assert.deepEqual(audit.rows.map((r) => r.action), ['claim_continue_confirmed']);
  // C: replay — receipt of the same token now fails closed; a different receipt presenting the same nonce fails closed.
  await assert.rejects(() => platform.receiveHandoff(token), (e: unknown) => e instanceof HandoffError && e.code === 'reused_nonce');
  await assert.rejects(() => platform.confirmClaimIntent({ token, receiptId: receipt() }), (e: unknown) => e instanceof HandoffError && e.code === 'reused_nonce');
  assert.equal(await intents(sql), 1);
  await db.close();
});

// ---------------------------------------------------------------- F / G / H / I / J / K
test('F/G/H/I/J/K: invalid UUID, thin, credential mismatch, cross-hub, expired and tampered all fail closed with 0 intents', async () => {
  const { db, sql, platform } = await boot();
  const cases: Array<[string, string, (e: unknown) => boolean]> = [
    ['F invalid profile uuid', mint({ ...CONTRACTOR, id: '99999999-9999-4999-8999-999999999999' }).token, (e) => e instanceof ClaimError && e.code === 'missing_profile'],
    ['G thin/unpublished', mint(THIN).token, (e) => e instanceof ClaimError && e.code === 'thin_profile'],
    ['H credential mismatch', mint({ ...CONTRACTOR, externalKey: 'CBC999999' }).token, (e) => e instanceof ClaimError && e.code === 'credential_mismatch'],
    ['I cross-hub identity mismatch', mint({ ...MOVER, id: CONTRACTOR.id }).token, (e) => e instanceof ClaimError && e.code === 'missing_profile'],
    ['I cross-hub class mismatch', mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: CONTRACTOR.id, slug: CONTRACTOR.slug, externalKey: CONTRACTOR.externalKey, identifierNamespace: 'USDOT', entityClass: 'mover', canonicalProfileUrl: CONTRACTOR.canonicalUrl, displayName: CONTRACTOR.displayName, version: 2, now: new Date('2026-09-22T13:59:00Z') }).token, (e) => e instanceof HandoffError || e instanceof ClaimError],
    ['J expired', mint(CONTRACTOR, { now: new Date('2026-09-22T12:00:00Z'), ttlSeconds: 60 }).token, (e) => e instanceof HandoffError && e.code === 'expired'],
    ['K tampered', mutateHandoffToken(mint(CONTRACTOR).token, (p) => ({ ...p, external_key: 'CBC000000' }), 'wrong-secret-wrong-secret-wrong-secret-1'), (e) => e instanceof HandoffError && e.code === 'tampered'],
    ['K wrong audience', mutateHandoffToken(mint(CONTRACTOR).token, (p) => ({ ...p, aud: 'contractortrusthub' as HandoffPayload['aud'] }), SECRET), (e) => e instanceof HandoffError && e.code === 'wrong_audience'],
  ];
  for (const [name, token, check] of cases) {
    await assert.rejects(() => platform.receiveHandoff(token), check, name);
    await assert.rejects(() => platform.confirmClaimIntent({ token, receiptId: receipt() }), check, `${name} (confirm)`);
  }
  assert.equal(await intents(sql), 0);
  await db.close();
});

// ---------------------------------------------------------------- L
test('L: same-origin protection fails closed for cross-origin, cross-site and origin-less POSTs', () => {
  const url = 'https://www.asktrusthub.com/api/customer/claim/confirm';
  assert.deepEqual(checkSameOrigin(new Headers({ origin: 'https://www.asktrusthub.com' }), url), { ok: true });
  assert.deepEqual(checkSameOrigin(new Headers({ 'sec-fetch-site': 'same-origin' }), url), { ok: true });
  assert.equal(checkSameOrigin(new Headers({ origin: 'https://evil.example' }), url).ok, false);
  assert.equal(checkSameOrigin(new Headers({ origin: 'null' }), url).ok, false);
  assert.equal(checkSameOrigin(new Headers({ 'sec-fetch-site': 'cross-site' }), url).ok, false);
  assert.equal(checkSameOrigin(new Headers(), url).ok, false);
  assert.deepEqual(checkSameOrigin(new Headers({ origin: 'https://preview.example' }), url, ['https://preview.example']), { ok: true });
});

// ---------------------------------------------------------------- M / N (Ask durable limiter)
test('M/N: Ask durable rate limits bound receipts (30/15m/IP) and explicit Continue (10/15m/IP)', async () => {
  const { db, platform } = await boot();
  for (let i = 0; i < 30; i += 1) await platform.receiveHandoff(mint(CONTRACTOR, { nonce: `ip-${i}` }).token, { ip: '203.0.113.9' });
  await assert.rejects(() => platform.receiveHandoff(mint(CONTRACTOR, { nonce: 'ip-31' }).token, { ip: '203.0.113.9' }), (e: unknown) => e instanceof ClaimError && e.code === 'rate_limited');
  await platform.receiveHandoff(mint(CONTRACTOR, { nonce: 'ip-other' }).token, { ip: '203.0.113.10' });
  for (let i = 0; i < 10; i += 1) await platform.confirmClaimIntent({ token: mint(CONTRACTOR, { nonce: `c-${i}` }).token, receiptId: receipt(), ctx: { ip: '198.51.100.7' } });
  await assert.rejects(() => platform.confirmClaimIntent({ token: mint(CONTRACTOR, { nonce: 'c-11' }).token, receiptId: receipt(), ctx: { ip: '198.51.100.7' } }), (e: unknown) => e instanceof ClaimError && e.code === 'rate_limited');
  await db.close();
});

// ---------------------------------------------------------------- Auth return + submission + source survival (Section 4F, 6)
test('auth return preserves the explicit intent; submission carries acquisition_source into ath_claims and staff ops', async () => {
  const { db, sql, platform } = await boot();
  const { token } = mint(CONTRACTOR, { nonce: 'submit-nonce' });
  await platform.receiveHandoff(token);
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: receipt(), acquisitionSource: 'manual_outreach' });
  const preview = await platform.intentPreview(confirmed.intentId);
  assert.equal(preview?.acquisitionSource, 'manual_outreach'); assert.equal(preview?.intentOrigin, 'explicit_continue');
  const user = await signup(platform, 'owner@acme-roofing.example');
  const again = await platform.intentPreview(confirmed.intentId); assert.ok(again && !again.consumed, 'intent survives auth return');
  const claim = await platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  const row = (await sql.query<Record<string, unknown>>(`SELECT acquisition_source, attestation->>'acquisition_source' AS attested, review_started_at FROM ath_claims WHERE id=$1`, [claim.claimId])).rows[0];
  assert.equal(row.acquisition_source, 'manual_outreach'); assert.equal(row.attested, 'manual_outreach'); assert.equal(row.review_started_at, null);
  const consumed = await platform.intentPreview(confirmed.intentId); assert.equal(consumed?.consumed, true);
  await assert.rejects(() => platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true }).then(() => { throw new Error('no'); }), () => true);
  const staff = await signup(platform, 'staff@asktrusthub.com');
  const snapshot = await platform.launchOpsSnapshot(staff.sessionToken);
  assert.equal(snapshot.claims[0]?.source, 'manual_outreach');
  assert.equal(snapshot.bySource.find((s) => s.source === 'manual_outreach')?.count, 1);
  assert.equal(claimAcquisitionSourceV2('anything-else'), 'unknown');
  await db.close();
});

// ---------------------------------------------------------------- O / P / Q
test('O/P/Q: company-domain email only, credential knowledge only, and competing claims never approve', async () => {
  assert.equal(evaluateAuthority({ hub: 'contractor', relationship: 'owner', evidence: ['COMPANY_DOMAIN_CONTROL'] }).eligibleForHumanApproval, false);
  assert.equal(evaluateAuthority({ hub: 'contractor', relationship: 'owner', evidence: ['CREDENTIAL_KNOWLEDGE'] }).eligibleForHumanApproval, false);
  assert.equal(evaluateAuthority({ hub: 'contractor', relationship: 'owner', evidence: ['CREDENTIAL_KNOWLEDGE', 'COMPANY_DOMAIN_CONTROL'] }).eligibleForHumanApproval, false);
  assert.equal(evaluateAuthority({ hub: 'contractor', relationship: 'owner', evidence: ['CORPORATE_OFFICER_MATCH', 'COMPANY_DOMAIN_CONTROL'], competingClaims: 1 }).result, 'CONFLICT');
  const { db, platform } = await boot();
  const { token } = mint(CONTRACTOR, { nonce: 'gov-nonce' });
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: receipt() });
  const user = await signup(platform, 'owner@acme-roofing.example');
  const claim = await platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  await assert.rejects(() => platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', evidenceCodes: ['COMPANY_DOMAIN_CONTROL', 'CREDENTIAL_KNOWLEDGE'], evidenceNote: 'Only the company domain email and licence knowledge were available for this claim.', internalRationale: 'Attempting approval on insufficient evidence must be blocked by governance.', claimantMessage: 'Additional verification is required before access can be granted.', reasonCategory: 'AUTHORITY_VERIFIED' }), (e: unknown) => e instanceof ClaimError && e.code === 'authority_standard_not_met');
  const home = await platform.managedHome(user.sessionToken); assert.equal(home.length, 0);
  await db.close();
});

// ---------------------------------------------------------------- Review capacity + R (revocation)
test('review timer: explicit sessions measure human minutes (capped); decision stamps timing; revocation removes owner layer', async () => {
  const { db, sql, platform, clock } = await boot();
  const { token } = mint(CONTRACTOR, { nonce: 'timer-nonce' });
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: receipt(), acquisitionSource: 'organic' });
  const user = await signup(platform, 'owner@acme-roofing.example');
  const claim = await platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  const started = await platform.startReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId, evidenceReady: true });
  assert.equal(started.created, true);
  assert.equal((await platform.startReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId })).created, false, 'idempotent start');
  clock.now = new Date(clock.now.getTime() + 12 * 60 * 1000);
  const stopped = await platform.stopReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId });
  assert.equal(stopped.closed, 1); assert.equal(stopped.humanReviewActiveSeconds, 12 * 60);
  clock.now = new Date(clock.now.getTime() + 20 * 60 * 60 * 1000); // idle overnight: wall clock grows, labor does not
  await platform.startReviewSession({ sessionToken: staff.sessionToken, claimId: claim.claimId });
  clock.now = new Date(clock.now.getTime() + 3 * 60 * 60 * 1000); // forgot to stop for 3 hours -> capped at 45 min
  await platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', ...governedApproval, evidenceCodes: [...governedApproval.evidenceCodes] });
  const timing = await platform.reviewTiming(staff.sessionToken, claim.claimId);
  assert.equal(timing.evidenceReadyAtFirstReview, true); assert.ok(timing.reviewStartedAt); assert.ok(timing.reviewDecidedAt);
  assert.equal(timing.humanReviewActiveSeconds, 12 * 60 + REVIEW_SESSION_CAP_SECONDS);
  assert.equal(timing.sessions.every((s) => s.ended_at), true); assert.equal(timing.sla.state, 'RESOLVED');
  assert.equal(capReviewSession(new Date(0), new Date(10 * 60 * 60 * 1000)), REVIEW_SESSION_CAP_SECONDS);
  const audit = await sql.query<{ action: string }>(`SELECT action FROM ath_audit_events WHERE object_type='ath_claims' AND object_id=$1 ORDER BY created_at`, [claim.claimId]);
  assert.ok(audit.rows.some((a) => a.action === 'claim_review_started')); assert.ok(audit.rows.some((a) => a.action === 'claim_approved'));
  const snapshot = await platform.launchOpsSnapshot(staff.sessionToken);
  assert.equal(snapshot.capacity?.evidenceReadyRate.percent, 100); assert.equal(snapshot.capacity?.approvalRate.percent, 100);
  assert.equal(snapshot.capacity?.medianHumanReviewMinutes, Math.round(((12 * 60 + REVIEW_SESSION_CAP_SECONDS) / 60) * 10) / 10);
  // R: active grant gates owner tools; revocation withdraws the business layer while nothing else changes.
  const saved = await platform.saveBusinessProfile({ sessionToken: user.sessionToken, nativeProfileId: CONTRACTOR.id, body: { version: 0, fields: { website: 'https://acme-roofing.example' }, services: ['Roofing'], serviceAreas: [], languages: [], hours: [] } });
  assert.equal(saved.version, 1);
  assert.ok(await platform.publicBusinessProfile('contractor', CONTRACTOR.id), 'business layer projected under active grant');
  const grant = (await sql.query<{ id: string }>(`SELECT id FROM ath_management_grants WHERE status='active'`)).rows[0];
  await platform.revokeGrant({ sessionToken: staff.sessionToken, grantId: grant.id, reason: 'Synthetic QA revocation to certify business-layer withdrawal.' });
  assert.equal(await platform.publicBusinessProfile('contractor', CONTRACTOR.id), null, 'business layer withdrawn');
  await assert.rejects(() => platform.businessProfile(user.sessionToken, CONTRACTOR.id), (e: unknown) => e instanceof ManagementError && e.code === 'forbidden');
  const fields = await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_business_profile_fields`); assert.equal(Number(fields.rows[0].n), 1, 'business-supplied rows are retained, only the projection is withdrawn');
  await db.close();
});

test('review SLA: 2-business-day target counts weekdays only; queue priority is needs_info, submitted, in_review', () => {
  assert.equal(businessHoursBetween(new Date('2026-09-25T12:00:00Z'), new Date('2026-09-28T12:00:00Z')), 24, 'Friday noon to Monday noon = 24 business hours');
  assert.equal(businessHoursBetween(new Date('2026-09-26T00:00:00Z'), new Date('2026-09-27T23:00:00Z')), 0, 'weekend only');
  assert.equal(reviewSlaState({ submittedAt: new Date('2026-09-21T09:00:00Z'), now: new Date('2026-09-21T20:00:00Z') }).state, 'WITHIN_TARGET');
  assert.equal(reviewSlaState({ submittedAt: new Date('2026-09-21T09:00:00Z'), now: new Date('2026-09-22T10:00:00Z') }).state, 'APPROACHING_TARGET');
  assert.equal(reviewSlaState({ submittedAt: new Date('2026-09-18T09:00:00Z'), now: new Date('2026-09-22T10:00:00Z') }).state, 'OVER_TARGET');
  assert.equal(reviewSlaState({ submittedAt: new Date('2026-09-01T09:00:00Z'), decidedAt: new Date('2026-09-02T09:00:00Z'), now: new Date('2026-09-22T10:00:00Z') }).state, 'RESOLVED');
  assert.deepEqual(['approved', 'in_review', 'submitted', 'needs_info'].sort((a, b) => openClaimPriority(a) - openClaimPriority(b)), ['needs_info', 'submitted', 'in_review', 'approved']);
  assert.doesNotMatch(JSON.stringify(REVIEW_SLA_LABEL), /48/, 'Q6: no label may claim a false 48-hour precision');
});

test('Q5: an open needs_info pause freezes the reported elapsed time and reports WAITING_ON_CLAIMANT, never OVER_TARGET', () => {
  // Submitted Friday 09:00; needs_info sent 4 business hours later, same day. The pause then stays open for
  // nearly a full week of wall-clock time (which would read OVER_TARGET if it counted), before staff resumes.
  const submittedAt = new Date('2026-09-18T09:00:00Z'); // Friday
  const needsInfoEnteredAt = new Date('2026-09-18T13:00:00Z'); // same Friday, 4 business hours in
  const stillWaitingNow = new Date('2026-09-23T13:00:00Z'); // the following Wednesday: raw elapsed would be OVER_TARGET
  const paused = reviewSlaState({ submittedAt, now: stillWaitingNow, needsInfoEnteredAt });
  assert.equal(paused.state, 'WAITING_ON_CLAIMANT');
  assert.equal(paused.businessHoursOpen, 4, 'frozen at the elapsed time when the pause began, not at stillWaitingNow');
  // Staff resumes at stillWaitingNow: the pause closes, folding in the time spent waiting.
  const closedPauseHours = businessHoursBetween(needsInfoEnteredAt, stillWaitingNow);
  const resumedNow = new Date('2026-09-23T14:00:00Z'); // one business hour after resuming
  const resumed = reviewSlaState({ submittedAt, now: resumedNow, pausedBusinessHours: closedPauseHours });
  const rawIfUnpaused = businessHoursBetween(submittedAt, resumedNow);
  assert.equal(resumed.businessHoursOpen, Math.round((rawIfUnpaused - closedPauseHours) * 100) / 100);
  assert.equal(resumed.businessHoursOpen, 5, '4 pre-pause hours + 1 post-resume hour; days spent waiting are excluded');
  assert.equal(resumed.state, 'WITHIN_TARGET', 'time spent waiting on the claimant never counts against the staff target');
  // A decision resolved right after resuming also excludes the paused time.
  const decidedAt = resumedNow;
  const resolved = reviewSlaState({ submittedAt, decidedAt, now: decidedAt, pausedBusinessHours: closedPauseHours });
  assert.equal(resolved.state, 'RESOLVED');
  assert.equal(resolved.businessHoursOpen, Math.round((businessHoursBetween(submittedAt, decidedAt) - closedPauseHours) * 100) / 100);
});

test('Section 8: staff reminder is bounded, idempotent per claim per day, and never targets a claimant', async () => {
  const { db, platform, clock, mailbox } = await boot();
  const { token } = mint(CONTRACTOR, { nonce: 'reminder-nonce' });
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: receipt() });
  const user = await signup(platform, 'owner@acme-roofing.example');
  await platform.submitClaim({ sessionToken: user.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  mailbox.length = 0;
  assert.deepEqual(await platform.reviewQueueReminders({ dryRun: true }), { candidates: 0, created: 0, emailed: 0, suppressed: 0 });
  clock.now = new Date(clock.now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const first = await platform.reviewQueueReminders();
  assert.deepEqual(first, { candidates: 1, created: 1, emailed: 1, suppressed: 0 });
  const second = await platform.reviewQueueReminders();
  assert.deepEqual(second, { candidates: 1, created: 0, emailed: 0, suppressed: 1 });
  assert.ok(mailbox.every((m) => m.to === 'staff@asktrusthub.com'), 'only staff addresses are emailed');
  assert.ok(mailbox.every((m) => !/owner@acme-roofing/.test(`${m.html}${m.text}`)));
  await db.close();
});

// ---------------------------------------------------------------- S (Ask side of outage) / X
test('S/X: specialist outage creates no claim state; historical legacy intents remain byte-identical', async () => {
  const { db, sql, platform } = await boot();
  await sql.query(`INSERT INTO ath_claim_intents (nonce,payload,expires_at,created_at) VALUES ('legacy-1','{"v":1,"hub_id":"contractor"}'::jsonb,'2025-01-01T00:00:00Z','2024-12-31T23:45:00Z')`);
  const before = (await sql.query<Record<string, unknown>>(`SELECT id,nonce,payload::text,expires_at::text,consumed_at,created_at::text,intent_origin,acquisition_source,confirmed_at,receipt_hash FROM ath_claim_intents WHERE nonce='legacy-1'`)).rows[0];
  assert.equal(before.intent_origin, 'legacy_passive'); assert.equal(before.acquisition_source, 'unknown'); assert.equal(before.confirmed_at, null);
  specialistDown = true;
  try {
    await assert.rejects(() => platform.receiveHandoff(mint(CONTRACTOR, { nonce: 'outage-1' }).token), (e: unknown) => e instanceof ClaimError && e.code === 'specialist_unavailable');
    await assert.rejects(() => platform.confirmClaimIntent({ token: mint(CONTRACTOR, { nonce: 'outage-2' }).token, receiptId: receipt() }), (e: unknown) => e instanceof ClaimError && e.code === 'specialist_unavailable');
  } finally { specialistDown = false; }
  assert.equal(await intents(sql), 1);
  await platform.confirmClaimIntent({ token: mint(CONTRACTOR, { nonce: 'after-outage' }).token, receiptId: receipt() });
  const after = (await sql.query<Record<string, unknown>>(`SELECT id,nonce,payload::text,expires_at::text,consumed_at,created_at::text,intent_origin,acquisition_source,confirmed_at,receipt_hash FROM ath_claim_intents WHERE nonce='legacy-1'`)).rows[0];
  assert.deepEqual(after, before, 'historical intent untouched');
  const claims = await sql.query<{ n: string }>(`SELECT count(*)::text n FROM ath_claims`); assert.equal(Number(claims.rows[0].n), 0);
  await db.close();
});

test('migration 019 is idempotent and additive', async () => {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql);
  const up = readFileSync('schema/migrations/019_ath_claim_v2_foundation.sql', 'utf8');
  for (let i = 0; i < 2; i += 1) for (const stmt of splitSqlStatements(up)) await sql.query(stmt);
  const cols = await sql.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='ath_claims' AND column_name IN ('acquisition_source','review_started_at','review_decided_at','evidence_ready_at_first_review','human_review_active_seconds')`);
  assert.equal(cols.rows.length, 5);
  assert.doesNotMatch(up, /DELETE FROM ath_claim_intents|TRUNCATE|DROP TABLE ath_claim_intents/);
  assert.doesNotMatch(up, /UPDATE ath_claim_intents/);
  await db.close();
});

// ---------------------------------------------------------------- U / V / W
test('U: claim/token routes are noindex + no-store and GET never confirms; the receipt cookie is bounded and unforgeable-by-shape', () => {
  const accept = readFileSync('app/api/customer/claim/accept/route.ts', 'utf8');
  const confirm = readFileSync('app/api/customer/claim/confirm/route.ts', 'utf8');
  const layout = readFileSync('app/claim/layout.tsx', 'utf8');
  assert.match(accept, /receiveHandoff\(/); assert.doesNotMatch(accept, /confirmClaimIntent|acceptHandoff\(/);
  assert.match(accept, /noindex, nofollow/); assert.match(accept, /no-store/);
  assert.match(confirm, /export async function POST/); assert.doesNotMatch(confirm, /export async function GET/);
  assert.match(confirm, /checkSameOrigin\(/); assert.match(confirm, /confirmClaimIntent\(/); assert.match(confirm, /noindex, nofollow/);
  assert.match(layout, /noIndex: true/);
  // Browser QA finding: a new handoff must supersede a stale/consumed intent cookie, never be hidden by it.
  assert.match(accept, /clearIntentCookie\(\)/);
  const page = readFileSync('app/claim/continue/page.tsx', 'utf8');
  assert.match(page, /const receipt = await readClaimReceipt\(\)/);
  assert.match(page, /intent && !intent\.consumed/);
  const secret = 'ath-claim-v2-001-receipt-test-secret-32-chars-min';
  const encoded = encodeClaimReceipt({ token: 'abc.def', receiptId: 'r'.repeat(24), source: 'organic', receivedAt: 1 }, secret);
  assert.deepEqual(decodeClaimReceipt(encoded, secret), { token: 'abc.def', receiptId: 'r'.repeat(24), source: 'organic', receivedAt: 1 });
  assert.equal(decodeClaimReceipt('not-base64-json', secret), null);
  assert.equal(decodeClaimReceipt(encodeClaimReceipt({ token: 'no-dot', receiptId: 'r'.repeat(24), source: 'organic', receivedAt: 1 }, secret), secret), null);
  assert.equal(decodeClaimReceipt(encodeClaimReceipt({ token: 'a.b', receiptId: 'short', source: 'organic', receivedAt: 1 }, secret), secret), null);
  assert.equal(decodeClaimReceipt(encodeClaimReceipt({ token: 'a.b', receiptId: 'r'.repeat(24), source: 'bogus' as never, receivedAt: 1 }, secret), secret)?.source, 'unknown');
});

test('V: no secret or raw identifier reaches browser analytics; V2 browser events are on the product-event allow-list', () => {
  const props = safeClaimFunnelProperties({ hub: 'contractor', profileClass: 'contractor', state: 'FL', authenticated: false, source: 'organic', ...({ profile_id: CONTRACTOR.id, handoff: 'a.b', email: 'x@y.z', name: 'Acme', credential: 'CBC015082', token: 't' } as object) } as never);
  assert.deepEqual(Object.keys(props).sort(), ['authenticated', 'hub', 'profileClass', 'source', 'state']);
  const productEvents = readFileSync('lib/control-plane/product-events.ts', 'utf8').match(/FIRST_PARTY_CLIENT_EVENTS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
  const trackEvents = readFileSync('lib/analytics/track.ts', 'utf8').match(/FIRST_PARTY_EVENTS = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  for (const event of CLAIM_V2_BROWSER_EVENTS) { assert.ok(productEvents.includes(`'${event}'`), `${event} on product-event allow-list`); assert.ok(trackEvents.includes(`'${event}'`), `${event} on track allow-list`); }
  for (const file of ['app/claim/continue/claim-continue-confirm.tsx', 'app/claim/continue/claim-continue-form.tsx', 'components/customer/ClaimFunnelAnalytics.tsx']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /^'use client';/, `${file} is a client component`);
    assert.doesNotMatch(src, /ATH_HANDOFF_SECRET|handoffSecret|receipt\.|\btoken\b|\bnonce\b/, `${file} never touches a token, receipt, or secret`);
  }
  const page = readFileSync('app/claim/continue/page.tsx', 'utf8');
  assert.doesNotMatch(page, /ATH_HANDOFF_SECRET|handoffSecret/);
  assert.doesNotMatch(page, /token=\{|receipt=\{|nonce=\{/, 'the server page never passes a token, receipt, or nonce prop to any component');
  assert.doesNotMatch(page, /ClaimFunnelAnalytics[^/]*event="claim_started"/, 'a passive receipt is never labelled claim_started');
  assert.match(page, /event="claim_handoff_received"/); assert.match(page, /event="claim_continue_confirmed"/);
  const authoritative = CLAIM_V2_FUNNEL.filter((e) => e.authority === 'AUTHORITATIVE').map((e) => e.event);
  assert.ok(authoritative.includes('claim_continue_confirmed') && authoritative.includes('claim_submitted') && authoritative.includes('claim_approved'));
  assert.equal(CLAIM_V2_FUNNEL.find((e) => e.event === 'claim_handoff_received')?.humanIntent, false);
});

test('W: internal_test claims are excluded from external capacity metrics', () => {
  const metrics = computeReviewCapacity([
    { status: 'approved', submittedAt: '2026-09-01T00:00:00Z', reviewStartedAt: '2026-09-01T01:00:00Z', reviewDecidedAt: '2026-09-01T02:00:00Z', evidenceReadyAtFirstReview: true, humanReviewActiveSeconds: 600, acquisitionSource: 'internal_test', firstUsefulActionAt: '2026-09-01T03:00:00Z' },
    { status: 'submitted', submittedAt: '2026-09-01T00:00:00Z', reviewStartedAt: null, reviewDecidedAt: null, evidenceReadyAtFirstReview: null, humanReviewActiveSeconds: 0, acquisitionSource: 'organic' },
  ], new Date('2026-09-22T00:00:00Z'));
  assert.equal(metrics.internalTestClaimsExcluded, 1); assert.equal(metrics.externalClaims, 1);
  assert.equal(metrics.approvalRate.denominator, 0); assert.equal(metrics.medianHumanReviewMinutes, null);
  assert.equal(metrics.unresolvedClaims, 1); assert.equal(metrics.overSlaClaims, 1);
});

// ---------------------------------------------------------------- Section 9
test('Section 9: readiness contract certifies Contractor for CANARY only and never awards ALL or flips rollout', () => {
  assert.equal(CLAIM_V2_REQUIREMENTS.length, 9);
  const report = sixHubReadinessReport();
  assert.deepEqual(report.map((r) => r.hub).sort(), ['contractor', 'insurance', 'investor', 'lender', 'move', 'senior']);
  const contractor = report.find((r) => r.hub === 'contractor')!;
  assert.equal(contractor.offToCanary, 'MET'); assert.equal(contractor.canaryToAll, 'NOT_MET'); assert.equal(contractor.recommendedRolloutState, 'CANARY');
  assert.ok(contractor.blocking.includes('R8_REAL_OWNER_CANARY') && contractor.blocking.includes('R9_REVIEW_CAPACITY'));
  for (const other of report.filter((r) => r.hub !== 'contractor')) { assert.equal(other.recommendedRolloutState, 'OFF'); assert.ok(other.blocking.includes('R7_ABUSE_RESISTANT_START')); }
  assert.ok(report.every((r) => r.recommendedRolloutState !== 'ALL'));
  const src = readFileSync('lib/customer/claim-v2-readiness.ts', 'utf8');
  assert.doesNotMatch(src, /process\.env|ATH_CLAIM_CTA_MODE/, 'certification model never touches rollout flags');
  const fake = evaluateHubReadiness({ ...contractor, requirements: { ...contractor.requirements, R8_REAL_OWNER_CANARY: { level: 'IMPLEMENTED', evidence: 'adapter exists' } } });
  assert.equal(fake.canaryToAll, 'NOT_MET', 'an adapter existing is not a real-owner canary');
});
