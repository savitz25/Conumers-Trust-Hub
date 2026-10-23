import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, beforeEach, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { applyCustomerMigrations } from '../customer/migrate.ts';
import type { SqlClient } from '../customer/sql.ts';
import { RESEARCH_SERVICE_VENDOR_COUNTS, RESEARCH_SERVICES_INQUIRY } from './inquiry.ts';
import { handleResearchInquiryPost, handleResearchInquiryRead } from './http.ts';
import { listResearchInquiries, retryResearchInquiryNotifications } from './operator.ts';
import { researchInquiryRateKey, submitResearchInquiry, type SubmitDeps } from './submit.ts';
import type { InquiryMailer, InquiryNotice } from './notify.ts';

const SECRET = 'test-secret-that-is-long-enough-123';
const base = {
  name: 'Avery Cole',
  email: 'avery@palmshore.example',
  organization: 'Palm Shore Management',
  role: 'Property manager',
  vendorCount: '11–25',
  message: 'We review roofing vendors for two associations.',
};

function key(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function asSql(db: PGlite): SqlClient {
  return {
    async query<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
      const result = await db.query<T>(text, params ?? []);
      return { rows: (result.rows ?? []) as T[] };
    },
    async exec(text: string) {
      await db.exec(text);
    },
  };
}

async function withTx<T>(db: PGlite, fn: (sql: SqlClient) => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  await db.query("SELECT set_config('ath.app_role', 'server', true)");
  try {
    const value = await fn(asSql(db));
    await db.query('COMMIT');
    return value;
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  }
}

function recorder(): { mailer: InquiryMailer; notices: InquiryNotice[] } {
  const notices: InquiryNotice[] = [];
  return {
    notices,
    mailer: async (notice) => {
      notices.push(notice);
      return { delivered: true, providerRef: 'test-transport' };
    },
  };
}

function deps(db: PGlite, mailer: InquiryMailer, logs: Array<{ event: string; fields: Record<string, string | number> }> = []): SubmitDeps {
  return {
    transaction: (fn) => withTx(db, fn),
    mailer,
    now: () => new Date('2026-10-23T15:00:00.000Z'),
    secret: SECRET,
    log: (event, fields) => logs.push({ event, fields }),
  };
}

async function storedCount(db: PGlite): Promise<number> {
  const row = await withTx(db, async (sql) => {
    const result = await sql.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ath_research_service_inquiries`);
    return Number(result.rows[0]?.n || 0);
  });
  return row;
}

describe('research inquiry storage', { concurrency: false }, () => {
  let db: PGlite;

  before(async () => {
    db = new PGlite();
    await applyCustomerMigrations(asSql(db));
  });

  beforeEach(async () => {
    await withTx(db, async (sql) => {
      await sql.query('DELETE FROM ath_research_service_inquiries');
      await sql.query('DELETE FROM ath_rate_events');
    });
  });

  test('migration is server-only and idempotent', async () => {
    const up = readFileSync('schema/migrations/020_ath_research_service_inquiries.sql', 'utf8');
    const down = readFileSync('schema/migrations/020_ath_research_service_inquiries.down.sql', 'utf8');
    assert.ok(up.includes(RESEARCH_SERVICE_VENDOR_COUNTS[0]));
    assert.match(up, /FORCE ROW LEVEL SECURITY/);
    assert.match(up, /REVOKE ALL ON TABLE ath_research_service_inquiries FROM PUBLIC/);
    assert.match(up, /REVOKE ALL ON TABLE ath_research_service_inquiries FROM anon/);
    assert.doesNotMatch(up, /\bGRANT\b/);
    assert.match(down, /DROP TABLE IF EXISTS ath_research_service_inquiries/);
    await db.exec(up);
    const route = readFileSync('app/api/research-services/inquiries/route.ts', 'utf8');
    const script = readFileSync('scripts/research-services-inquiries.ts', 'utf8');
    assert.match(route, /handleResearchInquiryRead/);
    assert.doesNotMatch(route, /console\.(log|info|error)/);
    assert.match(script, /RESEARCH_SERVICES_OPERATOR/);
    assert.match(script, /inboxDeliveryVerified: false/);
    assert.doesNotMatch(script, /console\.log\(process\.env/);
  });

  test('a valid inquiry is stored before the notice, and the visitor is not emailed', async () => {
    const logs: Array<{ event: string; fields: Record<string, string | number> }> = [];
    const sent = recorder();
    const result = await submitResearchInquiry({ idempotencyKey: key(1), honeypot: '', input: base, ip: '203.0.113.9' }, deps(db, sent.mailer, logs));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.stored, true);
    assert.equal(sent.notices.length, 1);
    assert.equal(sent.notices[0].to, RESEARCH_SERVICES_INQUIRY.inbox);
    assert.notEqual(sent.notices[0].to, base.email);
    const row = await withTx(db, (sql) => sql.query<{ notification_status: string; provider_message_ref: string }>(
      `SELECT notification_status, provider_message_ref FROM ath_research_service_inquiries WHERE id = $1::uuid`,
      [result.receiptId]
    ));
    assert.equal(row.rows[0].notification_status, 'sent');
    assert.equal(row.rows[0].provider_message_ref, 'test-transport');
    const rates = await withTx(db, (sql) => sql.query<{ rate_key: string }>(`SELECT rate_key FROM ath_rate_events`));
    const raw = JSON.stringify(rates.rows);
    assert.doesNotMatch(raw, /203\.0\.113\.9|palmshore/);
    assert.ok(rates.rows.some((item) => item.rate_key === researchInquiryRateKey(SECRET, 'ip', '203.0.113.9')));
    assert.doesNotMatch(JSON.stringify(logs), /Avery|palmshore|203\.0\.113\.9/);
  });

  test('notification failure keeps the saved inquiry and still confirms storage', async () => {
    const result = await submitResearchInquiry(
      { idempotencyKey: key(2), honeypot: '', input: base, ip: '203.0.113.10' },
      deps(db, async () => ({ delivered: false, errorCode: 'provider_rejected' }))
    );
    assert.deepEqual(result.ok && result.stored, true);
    if (!result.ok) return;
    const row = await withTx(db, (sql) => sql.query<{ notification_status: string; notification_error_code: string }>(
      `SELECT notification_status, notification_error_code FROM ath_research_service_inquiries WHERE id = $1::uuid`,
      [result.receiptId]
    ));
    assert.equal(row.rows[0].notification_status, 'failed');
    assert.equal(row.rows[0].notification_error_code, 'provider_rejected');
    const response = await handleResearchInquiryPost(new Request('https://www.asktrusthub.com/api/research-services/inquiries', {
      method: 'POST',
      headers: { origin: 'https://www.asktrusthub.com', 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: key(2), ...base }),
    }), deps(db, async () => { throw new Error('late'); }));
    const body = await response.json() as { stored?: boolean; receiptId?: string };
    assert.equal(response.status, 200);
    assert.equal(body.stored, true);
    assert.equal(body.receiptId, result.receiptId);
    assert.doesNotMatch(JSON.stringify(body), /palmshore|failed/);
    assert.equal(await storedCount(db), 1);
  });

  test('invalid input, duplicates, and limits do not create extra inquiries', async () => {
    const sent = recorder();
    const invalid = await submitResearchInquiry(
      { idempotencyKey: key(3), honeypot: '', input: { ...base, email: 'not-an-email', role: 'Owner' }, ip: '203.0.113.11' },
      deps(db, sent.mailer)
    );
    assert.equal(invalid.ok, false);
    if (invalid.ok) return;
    assert.equal(invalid.error, 'invalid');
    assert.equal(sent.notices.length, 0);
    assert.equal(await storedCount(db), 0);

    const first = await submitResearchInquiry({ idempotencyKey: key(4), honeypot: '', input: base, ip: '203.0.113.11' }, deps(db, sent.mailer));
    const replay = await submitResearchInquiry({ idempotencyKey: key(4), honeypot: '', input: base, ip: '203.0.113.11' }, deps(db, sent.mailer));
    const sameContent = await submitResearchInquiry({ idempotencyKey: key(5), honeypot: '', input: base, ip: '198.51.100.8' }, deps(db, sent.mailer));
    assert.equal(first.ok && replay.ok && sameContent.ok, true);
    if (!first.ok || !replay.ok || !sameContent.ok) return;
    assert.equal(replay.receiptId, first.receiptId);
    assert.equal(sameContent.receiptId, first.receiptId);
    assert.equal(sent.notices.length, 1);
    assert.equal(await storedCount(db), 1);

    await withTx(db, (sql) => sql.query(
      `UPDATE ath_research_service_inquiries SET created_at = '2026-10-23T14:00:00.000Z' WHERE id = $1::uuid`,
      [first.receiptId]
    ));
    const later = await submitResearchInquiry(
      { idempotencyKey: key(6), honeypot: '', input: { ...base, message: 'A later distinct request.' }, ip: '203.0.113.11' },
      deps(db, sent.mailer)
    );
    assert.equal(later.ok, true);
    if (!later.ok) return;
    assert.notEqual(later.receiptId, first.receiptId);

    const limitedDeps = deps(db, sent.mailer);
    limitedDeps.limits = {
      attempt: { max: 2, windowMs: 60_000 },
      ip: { max: 2, windowMs: 60_000 },
      email: { max: 1, windowMs: 60_000 },
      global: { max: 5, windowMs: 60_000 },
      duplicateWindowMs: 15 * 60 * 1000,
    };
    const emailLimited = await submitResearchInquiry(
      { idempotencyKey: key(7), honeypot: '', input: { ...base, message: 'Another organization note.' }, ip: '203.0.113.20' },
      limitedDeps
    );
    assert.equal(emailLimited.ok, false);
    if (emailLimited.ok) return;
    assert.equal(emailLimited.error, 'rate_limited');
  });

  test('anonymous database sessions cannot read or insert inquiries', async () => {
    const sent = recorder();
    const saved = await submitResearchInquiry({ idempotencyKey: key(8), honeypot: '', input: base, ip: '203.0.113.30' }, deps(db, sent.mailer));
    assert.equal(saved.ok, true);
    await db.query('BEGIN');
    await db.query(`CREATE ROLE research_inquiry_granted NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    await db.query(`GRANT SELECT, INSERT ON ath_research_service_inquiries TO research_inquiry_granted`);
    await db.query('SET LOCAL ROLE research_inquiry_granted');
    const hidden = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ath_research_service_inquiries`);
    assert.equal(Number(hidden.rows[0].n), 0);
    await assert.rejects(() => db.query(
      `INSERT INTO ath_research_service_inquiries (
          idempotency_key, content_fingerprint, name, email, email_normalized, organization, role, vendor_count, message
        ) VALUES ($1, $2, 'Ann Other', 'ann@example.test', 'ann@example.test', 'Other Org', 'Other', '1–10', '')`,
      [key(9), 'a'.repeat(64)]
    ));
    await db.query('ROLLBACK');
    const read = handleResearchInquiryRead();
    assert.equal(read.status, 404);
    const listed = await read.json() as { error?: string };
    assert.equal(listed.error, 'not_found');
    assert.doesNotMatch(JSON.stringify(listed), /Avery|palmshore/);
  });

  test('the operator can list inquiries and retry a failed notice without a second row', async () => {
    const saved = await submitResearchInquiry(
      { idempotencyKey: key(10), honeypot: '', input: base, ip: '203.0.113.40' },
      deps(db, async () => ({ delivered: false, errorCode: 'network' }))
    );
    assert.equal(saved.ok, true);
    const calls: InquiryNotice[] = [];
    const dry = await retryResearchInquiryNotifications({
      transaction: (fn) => withTx(db, fn),
      mailer: async (notice) => {
        calls.push(notice);
        return { delivered: true, providerRef: 'retry-1' };
      },
      now: () => new Date('2026-10-23T15:00:00.000Z'),
      send: false,
    });
    assert.equal(dry.length, 1);
    assert.equal(dry[0].attempted, false);
    assert.equal(calls.length, 0);
    const sent = await retryResearchInquiryNotifications({
      transaction: (fn) => withTx(db, fn),
      mailer: async (notice) => {
        calls.push(notice);
        return { delivered: true, providerRef: 'retry-1' };
      },
      now: () => new Date('2026-10-23T15:00:00.000Z'),
      send: true,
    });
    assert.equal(sent[0].notificationStatus, 'sent');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].to, 'hello@asktrusthub.com');
    const again = await retryResearchInquiryNotifications({
      transaction: (fn) => withTx(db, fn),
      mailer: async (notice) => {
        calls.push(notice);
        return { delivered: true };
      },
      now: () => new Date('2026-10-23T15:00:00.000Z'),
      send: true,
    });
    assert.equal(again.length, 0);
    assert.equal(calls.length, 1);
    const rows = await withTx(db, (sql) => listResearchInquiries(sql, { status: 'sent' }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, base.email);
    assert.equal(await storedCount(db), 1);
  });

  test('http rejects cross-origin, oversized, vendor-list, and honeypot requests before storage', async () => {
    const calls: string[] = [];
    const gate: SubmitDeps = {
      ...deps(db, async () => ({ delivered: true })),
      transaction: async (fn) => {
        calls.push('tx');
        return withTx(db, fn);
      },
    };
    const origin = await handleResearchInquiryPost(new Request('https://www.asktrusthub.com/api/research-services/inquiries', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: key(11), ...base }),
    }), gate);
    assert.equal(origin.status, 403);
    const vendors = await handleResearchInquiryPost(new Request('https://www.asktrusthub.com/api/research-services/inquiries', {
      method: 'POST',
      headers: { origin: 'https://www.asktrusthub.com', 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: key(12), ...base, vendors: ['Alpha Roofing'] }),
    }), gate);
    assert.equal(vendors.status, 400);
    const huge = await handleResearchInquiryPost(new Request('https://www.asktrusthub.com/api/research-services/inquiries', {
      method: 'POST',
      headers: { origin: 'https://www.asktrusthub.com', 'content-type': 'application/json' },
      body: 'x'.repeat(8001),
    }), gate);
    assert.equal(huge.status, 413);
    const honeypot = await handleResearchInquiryPost(new Request('https://www.asktrusthub.com/api/research-services/inquiries', {
      method: 'POST',
      headers: { origin: 'https://www.asktrusthub.com', 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: key(13), ...base, company_website_leave_blank: 'https://spam.example' }),
    }), gate);
    assert.equal(honeypot.status, 400);
    const honeypotBody = await honeypot.json() as { stored?: boolean; error?: string };
    assert.notEqual(honeypotBody.stored, true);
    assert.equal(honeypotBody.error, 'rejected');
    assert.equal(calls.length, 1);
    assert.equal(await storedCount(db), 0);
  });
});
