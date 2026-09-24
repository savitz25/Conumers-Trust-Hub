/**
 * ATH-CLAIM-V2-001R4 — first-approval publication latency (P0).
 *
 * Models production faithfully: a shared (cross-instance) data cache with tag expiry — the Vercel Data Cache behind
 * `unstable_cache` + `revalidateTag(tag, { expire: 0 })` — and two independent in-process read layers (the instance
 * that performed the write, and a warm reader instance the write cannot reach). Runs the real store on PGlite with the
 * real migrations. No production connection. No real customer data.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations, enableAppRole } from './migrate.ts';
import { CustomerPlatform } from './store.ts';
import { mintHandoffToken } from './handoff.ts';
import {
  createPublicContractorReadLayer,
  EXISTENCE_TTL_MS,
  PUBLIC_CACHE_CONTROL,
  PUBLIC_READ_S_MAXAGE,
  PUBLIC_READ_SWR,
  PUBLIC_VISIBILITY_WORST_CASE_S,
  SHARED_REVALIDATE_S,
} from './public-read-layer.ts';
import {
  PUBLIC_EXISTENCE_TAG,
  publicStateTag,
  registerPublicReadInvalidator,
  withDeferredPublicReadInvalidation,
  invalidatePublicContractorRead,
} from './public-read-invalidate.ts';
import type { CustomerProfileDirectory } from './adapter.ts';
import type { CustomerProfileRecord } from './types.ts';
import type { SqlClient } from './sql.ts';

const SECRET = 'ath-claim-v2-001r4-handoff-secret-32-characters-min';
const CONTRACTOR: CustomerProfileRecord = { id: '11111111-1111-4111-8111-111111111111', hubId: 'contractor', entityClass: 'contractor', slug: 'cbc015082-acme-roofing', displayName: 'Acme Roofing LLC', isThin: false, publicationEligible: true, homeState: 'FL', licenseState: 'FL', externalKey: 'CBC015082', sourceSystem: 'fl_dbpr', canonicalUrl: 'https://www.contractortrusthub.com/contractors/cbc015082-acme-roofing' };
const directory: CustomerProfileDirectory = { async getExact(p) { return p.hub_id === 'contractor' && p.native_profile_id === CONTRACTOR.id ? CONTRACTOR : null; } };
const governedApproval = { evidenceCodes: ['CORPORATE_OFFICER_MATCH', 'COMPANY_DOMAIN_CONTROL'], evidenceNote: 'Current corporate officer source checked independently; authenticated business-domain control confirmed.', internalRationale: 'Independent authority plus separately validated control satisfies the Contractor standard.', claimantMessage: 'Ask Trust Hub verified authority through independent business records and contact verification.', reasonCategory: 'AUTHORITY_VERIFIED' as const };
const replyBody = { replyType: 'CONTEXT', targetType: 'LICENSE_RECORD', targetRecordId: 'CBC015082', body: 'This response provides concise business context while leaving the official record unchanged.' };

function asSql(db: PGlite): SqlClient { return { async query(text, params) { const r = await db.query(text, params ?? []); return { rows: (r.rows ?? []) as Record<string, unknown>[] }; }, async exec(sql) { await db.exec(sql); } }; }

/** Vercel Data Cache stand-in: entries are shared by every instance; a tag expiry makes older entries a miss. */
function sharedDataCache(now: () => number) {
  const entries = new Map<string, { value: unknown; at: number; seq: number; tags: string[] }>();
  const tagExpiredSeq = new Map<string, number>();
  let seq = 0;
  let neonCalls = 0;
  return {
    async get<T>(key: string, tags: string[], load: () => Promise<T>): Promise<T> {
      const e = entries.get(key);
      const fresh = e && now() - e.at < SHARED_REVALIDATE_S * 1000 && tags.every((t) => (tagExpiredSeq.get(t) ?? -1) < e.seq);
      if (fresh) return e!.value as T;
      neonCalls += 1;
      const value = await load();
      entries.set(key, { value, at: now(), seq: ++seq, tags });
      return value;
    },
    revalidateTag(tag: string) { tagExpiredSeq.set(tag, ++seq); },
    neonCalls: () => neonCalls,
  };
}

// The invalidator registry is process-global (as in production); tests point it at the current harness.
let current: { shared: ReturnType<typeof sharedDataCache>; writer: ReturnType<typeof createPublicContractorReadLayer>; fired: string[]; failShared: boolean } | null = null;
registerPublicReadInvalidator((id) => {
  if (!current) return;
  current.fired.push(id);
  if (current.failShared) throw new Error('simulated revalidateTag outage');
  // Mirrors lib/customer/server.ts: expire the shared tags now.
  current.shared.revalidateTag(PUBLIC_EXISTENCE_TAG);
  current.shared.revalidateTag(publicStateTag(id));
});
// Mirrors lib/customer/public-read-server.ts: same-instance memo clear (registered after, so a shared failure above
// is isolated by the registry and this still runs).
registerPublicReadInvalidator((id) => current?.writer.invalidate(id));

async function boot() {
  const db = new PGlite(); const sql = asSql(db);
  await applyCustomerMigrations(sql); await db.query('BEGIN'); await enableAppRole(sql);
  const clock = { now: new Date('2026-09-22T14:00:00Z') };
  const platform = new CustomerPlatform({ sql, cth: directory, mailer: async (m) => ({ sent: true, preview: m.text }), handoffSecret: SECRET, staffEmails: ['staff@asktrusthub.com'], siteUrl: 'https://www.asktrusthub.com', now: () => clock.now });
  let cacheNow = 1_000_000;
  const now = () => cacheNow;
  const shared = sharedDataCache(now);
  const instance = () => createPublicContractorReadLayer({
    listPublicIds: () => shared.get('list', [PUBLIC_EXISTENCE_TAG], () => platform.listPublicContractorNativeIds()),
    loadPublishedState: (id) => shared.get(`state:${id}`, [publicStateTag(id)], async () => ({ profile: await platform.publicBusinessProfile('contractor', id), replies: (await platform.publicBusinessReplies('contractor', id)).replies })),
    now,
  });
  const writer = instance();
  const reader = instance();
  current = { shared, writer, fired: [], failShared: false };
  return { db, sql, platform, clock, shared, writer, reader, advance: (ms: number) => { cacheNow += ms; } };
}
async function signup(platform: CustomerPlatform, email: string) { const sent = await platform.requestMagicLink({ email, nextPath: '/claim/continue' }); const m = sent.preview?.match(/token=([^&\s]+)/); assert.ok(m); return platform.consumeMagicLink(decodeURIComponent(m[1])); }
async function approvedOwner(platform: CustomerPlatform) {
  const { token } = mintHandoffToken(SECRET, { hubId: 'contractor', nativeProfileId: CONTRACTOR.id, slug: CONTRACTOR.slug, externalKey: CONTRACTOR.externalKey, sourceSystem: CONTRACTOR.sourceSystem, homeState: 'FL', identifierNamespace: 'credential', entityClass: 'contractor', canonicalProfileUrl: CONTRACTOR.canonicalUrl, displayName: CONTRACTOR.displayName, version: 2, now: new Date('2026-09-22T13:59:00Z') });
  await platform.receiveHandoff(token);
  const confirmed = await platform.confirmClaimIntent({ token, receiptId: `r4-${randomUUID()}`, acquisitionSource: 'organic' });
  const owner = await signup(platform, 'owner@acme-roofing.example');
  const claim = await platform.submitClaim({ sessionToken: owner.sessionToken, intentId: confirmed.intentId, relationshipType: 'owner', credentialAttestation: CONTRACTOR.externalKey, authorized: true });
  const staff = await signup(platform, 'staff@asktrusthub.com');
  await platform.staffDecide({ sessionToken: staff.sessionToken, claimId: claim.claimId, decision: 'approve', ...governedApproval });
  return { owner, staff };
}
const website = (s: { profile: unknown }) => String((s.profile as { fields?: Record<string, unknown> } | null)?.fields?.website ?? '').replace(/\/$/, '');
const save = (platform: CustomerPlatform, token: string, version: number, url: string) => platform.saveBusinessProfile({ sessionToken: token, nativeProfileId: CONTRACTOR.id, body: { version, fields: { website: url, public_phone: '(305) 555-0100' }, services: ['Roofing'], serviceAreas: [], languages: [], hours: [] } });

test('R4 1-6: unknown -> first approval/save -> update -> reply -> revoke, visible on writer now and on a warm reader within the bound', async () => {
  const { db, sql, platform, shared, writer, reader, advance } = await boot();
  // 1. Unknown profile read on both instances: none, and nothing stored per-ID (the old 6h "none" pin).
  for (const layer of [writer, reader]) {
    const none = await layer.read(CONTRACTOR.id);
    assert.equal(none.source, 'existence_miss'); assert.equal(none.state.hasPublicBusinessProfile, false);
    assert.equal(layer.stats().cachedPayloads, 0);
  }
  // 2. Owner becomes valid; first business-profile save. Both writes invalidate (server-side, post-commit in prod).
  const { owner, staff } = await approvedOwner(platform);
  assert.deepEqual(current!.fired, [CONTRACTOR.id], 'approval invalidates');
  await save(platform, owner.sessionToken, 0, 'https://acme-roofing.example');
  assert.deepEqual(current!.fired, [CONTRACTOR.id, CONTRACTOR.id], 'first save invalidates');
  // 3. Next public read: the writer instance sees the owner layer immediately (shared cache expired, memo cleared).
  const w = await writer.read(CONTRACTOR.id);
  assert.equal(w.source, 'neon_load'); assert.equal(w.state.hasPublicBusinessProfile, true); assert.equal(website(w.state), 'https://acme-roofing.example');
  //    The warm reader instance cannot be reached by the write; it converges when its memo expires (measured bound).
  assert.equal((await reader.read(CONTRACTOR.id)).state.hasPublicBusinessProfile, false, 'reader memo is the measured cross-instance bound');
  advance(EXISTENCE_TTL_MS + 1);
  const neonBefore = shared.neonCalls();
  const r = await reader.read(CONTRACTOR.id);
  assert.equal(r.state.hasPublicBusinessProfile, true); assert.equal(website(r.state), 'https://acme-roofing.example');
  assert.equal(shared.neonCalls(), neonBefore, 'reader converges from the shared cache the writer refreshed: zero extra Neon queries');
  // 4. Update an existing field: fresh value on the writer now and on the reader within the bound.
  await save(platform, owner.sessionToken, 1, 'https://www.acme-roofing.example/new');
  assert.equal(website((await writer.read(CONTRACTOR.id)).state), 'https://www.acme-roofing.example/new');
  advance(EXISTENCE_TTL_MS + 1);
  assert.equal(website((await reader.read(CONTRACTOR.id)).state), 'https://www.acme-roofing.example/new');
  // 5. Approved reply publishes and appears.
  const draft = await platform.createBusinessReply({ sessionToken: owner.sessionToken, nativeProfileId: CONTRACTOR.id, body: replyBody });
  await platform.customerBusinessReplyAction({ sessionToken: owner.sessionToken, nativeProfileId: CONTRACTOR.id, replyId: draft.id, action: 'submit', version: 1 });
  await platform.staffTransitionBusinessReply({ sessionToken: staff.sessionToken, replyId: draft.id, nextStatus: 'UNDER_REVIEW', version: 2 });
  await platform.staffTransitionBusinessReply({ sessionToken: staff.sessionToken, replyId: draft.id, nextStatus: 'APPROVED', version: 3 });
  assert.equal((await writer.read(CONTRACTOR.id)).state.hasPublicReply, true);
  advance(EXISTENCE_TTL_MS + 1);
  assert.equal((await reader.read(CONTRACTOR.id)).state.hasPublicReply, true);
  // 6. Revoke: layer disappears (writer now, reader within the bound). Official evidence is not in this layer at all.
  const grant = (await sql.query<{ id: string }>(`SELECT id FROM ath_management_grants WHERE status='active'`)).rows[0];
  await platform.revokeGrant({ sessionToken: staff.sessionToken, grantId: grant.id, reason: 'Synthetic QA revocation to certify business-layer withdrawal.' });
  const gone = await writer.read(CONTRACTOR.id);
  assert.equal(gone.state.hasPublicBusinessProfile, false); assert.equal(gone.state.hasPublicReply, false); assert.equal(gone.source, 'existence_miss');
  advance(EXISTENCE_TTL_MS + 1);
  const goneReader = await reader.read(CONTRACTOR.id);
  assert.equal(goneReader.state.hasPublicBusinessProfile, false); assert.equal(goneReader.state.hasPublicReply, false);
  assert.ok(shared.neonCalls() < 20, `bounded Neon work across the whole lifecycle (${shared.neonCalls()})`);
  await db.close();
});

test('R4 7: 1,000 unrelated unknown IDs across two instances keep bounded Neon behaviour (no per-ID query, no per-ID memory)', async () => {
  const { db, shared, writer, reader } = await boot();
  let neonTouches = 0;
  const burst = await Promise.all(Array.from({ length: 1000 }, (_, i) => (i % 2 ? writer : reader).read(randomUUID())));
  for (const r of burst) { neonTouches += r.neonQueries; assert.equal(r.state.hasPublicBusinessProfile, false); }
  // Two instances cold at the same instant may each miss the shared cache once; never one query per ID.
  assert.ok(shared.neonCalls() <= 2, `≤ one shared list load per cold instance (${shared.neonCalls()})`);
  assert.ok(neonTouches <= 2, `≤ one list call per instance (${neonTouches})`);
  assert.equal(writer.stats().loadCalls + reader.stats().loadCalls, 0);
  assert.equal(writer.stats().cachedPayloads + reader.stats().cachedPayloads, 0, 'random UUIDs cannot grow memory');
  assert.equal(writer.stats().listCalls, 1); assert.equal(reader.stats().listCalls, 1);
  await db.close();
});

test('R4 8: invalidation failure never breaks the mutation and recovers within SHARED_REVALIDATE_S (documented bounded stale)', async () => {
  const { db, platform, writer, reader, advance } = await boot();
  assert.equal((await reader.read(CONTRACTOR.id)).state.hasPublicBusinessProfile, false);
  current!.failShared = true;
  const { owner } = await approvedOwner(platform);
  const saved = await save(platform, owner.sessionToken, 0, 'https://acme-roofing.example');
  assert.equal(saved.version, 1, 'mutation succeeded despite a failing invalidator');
  // Same-instance memo still cleared (registry isolates listener failures); the shared entry is stale.
  assert.equal((await writer.read(CONTRACTOR.id)).state.hasPublicBusinessProfile, false, 'shared cache still holds the pre-write list');
  advance(EXISTENCE_TTL_MS + 1);
  assert.equal((await reader.read(CONTRACTOR.id)).state.hasPublicBusinessProfile, false);
  advance(SHARED_REVALIDATE_S * 1000);
  assert.equal((await reader.read(CONTRACTOR.id)).state.hasPublicBusinessProfile, true, 'backstop revalidation recovers');
  await db.close();
});

test('R4: invalidation is deferred until the transaction resolves (post-COMMIT) and a rollback invalidates nothing', async () => {
  const fired: string[] = [];
  const probe = randomUUID();
  registerPublicReadInvalidator((id) => { if (id.startsWith('r4-probe-')) fired.push(id); });
  await withDeferredPublicReadInvalidation(async () => {
    invalidatePublicContractorRead(`r4-probe-${probe}`);
    invalidatePublicContractorRead(`r4-probe-${probe}`);
    assert.deepEqual(fired, [], 'nothing fires before COMMIT');
  });
  assert.deepEqual(fired, [`r4-probe-${probe}`], 'fires once after resolve (deduplicated)');
  await assert.rejects(() => withDeferredPublicReadInvalidation(async () => { invalidatePublicContractorRead(`r4-probe-rollback-${probe}`); throw new Error('rollback'); }));
  assert.equal(fired.some((id) => id.includes('rollback')), false, 'rolled-back write invalidates nothing');
});

test('R4: shared-cache outage fails closed (read rejects -> route 503 no-store -> Contractor omits business layer)', async () => {
  const layer = createPublicContractorReadLayer({ listPublicIds: async () => { throw new Error('neon down'); }, loadPublishedState: async () => ({ profile: {}, replies: [] }) });
  await assert.rejects(() => layer.read(CONTRACTOR.id));
  const route = readFileSync('app/api/public/contractor-profiles/[profileId]/public-state/route.ts', 'utf8');
  assert.match(route, /status: 503/); assert.match(route, /no-store/);
});

test('R4 wiring: writer instances always register the shared invalidator; expiry is immediate; no client-controlled invalidation', () => {
  const server = readFileSync('lib/customer/server.ts', 'utf8');
  assert.match(server, /registerPublicReadInvalidator\(/);
  assert.match(server, /revalidateTag\(PUBLIC_EXISTENCE_TAG, \{ expire: 0 \}\)/);
  assert.match(server, /revalidateTag\(publicStateTag\(nativeProfileId\), \{ expire: 0 \}\)/);
  const db = readFileSync('lib/customer/db.ts', 'utf8');
  assert.match(db, /withDeferredPublicReadInvalidation\(\(\) => runAskTx\(fn\)\)/);
  const readServer = readFileSync('lib/customer/public-read-server.ts', 'utf8');
  assert.doesNotMatch(readServer, /'max'/, 'the SWR "max" profile served the pre-write value once more');
  assert.match(readServer, /tags: \[publicStateTag\(id\)\]/, 'state tag now tags a real cache entry');
  // Only server-side store mutations may invalidate: nothing under app/ imports the invalidator.
  const grep = (dir: string): string[] => {
    return readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? grep(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
  };
  const offenders = grep('app').filter((p) => /public-read-invalidate|invalidatePublicContractorRead/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(offenders, []);
  assert.equal(PUBLIC_VISIBILITY_WORST_CASE_S, EXISTENCE_TTL_MS / 1000 + PUBLIC_READ_S_MAXAGE + PUBLIC_READ_SWR);
  assert.equal(PUBLIC_VISIBILITY_WORST_CASE_S, 150);
  assert.match(PUBLIC_CACHE_CONTROL, /s-maxage=60, stale-while-revalidate=60$/);
});
