import { hmacSha256, hashToken, normalizeEmail } from '../customer/crypto.ts';
import { one, type SqlClient } from '../customer/sql.ts';
import {
  RESEARCH_INQUIRY_LIMITS,
  validateResearchInquiry,
  type ResearchInquiryErrors,
  type ResearchInquiryInput,
} from './inquiry.ts';
import { buildResearchInquiryNotice, type InquiryMailer } from './notify.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InquiryLimits = {
  attempt: { max: number; windowMs: number };
  ip: { max: number; windowMs: number };
  email: { max: number; windowMs: number };
  global: { max: number; windowMs: number };
  duplicateWindowMs: number;
};

export type SubmitDeps = {
  transaction: <T>(fn: (sql: SqlClient) => Promise<T>) => Promise<T>;
  mailer: InquiryMailer;
  now: () => Date;
  secret: string;
  limits?: InquiryLimits;
  log?: (event: string, fields: Record<string, string | number>) => void;
};

export type SubmitResult =
  | { ok: true; stored: true; receiptId: string }
  | { ok: false; error: 'invalid'; fields: ResearchInquiryErrors }
  | { ok: false; error: 'rejected' | 'rate_limited' | 'unavailable' };

type StoredRow = { id: string; created: boolean };

export function researchInquiryRateKey(secret: string, kind: 'attempt' | 'ip' | 'email', value: string): string {
  return hmacSha256(secret, `RESEARCH_INQUIRY_${kind.toUpperCase()}_V1:${value}`);
}

function limitsOf(deps: SubmitDeps): InquiryLimits {
  return deps.limits ?? RESEARCH_INQUIRY_LIMITS;
}

function safeLog(deps: SubmitDeps, event: string, fields: Record<string, string | number>) {
  const safe: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/email|name|message|organization|body|text|subject|ip|secret|token/i.test(key)) continue;
    if (typeof value === 'string' && value.includes('@')) continue;
    safe[key] = value;
  }
  deps.log?.(event, safe);
}

async function lock(sql: SqlClient, key: string) {
  await sql.query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [key]);
}

async function countSince(sql: SqlClient, bucket: string, rateKey: string, since: string): Promise<number> {
  const row = await one<{ n: string }>(
    sql,
    `SELECT COUNT(*)::text AS n FROM ath_rate_events WHERE bucket = $1 AND rate_key = $2 AND created_at >= $3`,
    [bucket, rateKey, since]
  );
  return Number(row?.n || 0);
}

async function markAttempt(sql: SqlClient, rateKey: string, at: string) {
  await sql.query(
    `INSERT INTO ath_rate_events (bucket, rate_key, created_at) VALUES ('research_inquiry_attempt', $1, $2)`,
    [rateKey, at]
  );
}

export async function submitResearchInquiry(
  request: { idempotencyKey: string; honeypot: string; input: ResearchInquiryInput; ip: string },
  deps: SubmitDeps
): Promise<SubmitResult> {
  if (deps.secret.trim().length < 16) {
    safeLog(deps, 'research_inquiry_unavailable', { reason: 'secret' });
    return { ok: false, error: 'unavailable' };
  }
  const limits = limitsOf(deps);
  const at = deps.now().toISOString();
  const attemptKey = researchInquiryRateKey(deps.secret, 'attempt', request.ip || 'unknown');
  const parsed = validateResearchInquiry(request.input);
  const honeypotFilled = request.honeypot.trim().length > 0;
  const idempotencyOk = UUID_V4.test(request.idempotencyKey);

  if (honeypotFilled || !idempotencyOk || !parsed.ok) {
    const gate = await consumeAttempt(deps, attemptKey, at, limits.attempt);
    if (gate === 'unavailable') return { ok: false, error: 'unavailable' };
    if (gate === 'limited') return { ok: false, error: 'rate_limited' };
    if (!parsed.ok && idempotencyOk && !honeypotFilled) return { ok: false, error: 'invalid', fields: parsed.errors };
    return { ok: false, error: 'rejected' };
  }

  const value = parsed.value;
  const email = normalizeEmail(value.email);
  const fingerprint = hashToken(JSON.stringify([value.name, email, value.organization, value.role, value.vendorCount, value.message]));
  const ipKey = researchInquiryRateKey(deps.secret, 'ip', request.ip || 'unknown');
  const emailKey = researchInquiryRateKey(deps.secret, 'email', email);

  let stored: StoredRow;
  try {
    stored = await deps.transaction(async (sql) => {
      const existing = await one<{ id: string }>(
        sql,
        `SELECT id::text AS id FROM ath_research_service_inquiries WHERE idempotency_key = $1`,
        [request.idempotencyKey]
      );
      if (existing?.id) return { id: existing.id, created: false };
      const sinceDuplicate = new Date(deps.now().getTime() - limits.duplicateWindowMs).toISOString();
      const duplicate = await one<{ id: string }>(
        sql,
        `SELECT id::text AS id FROM ath_research_service_inquiries
          WHERE content_fingerprint = $1 AND created_at >= $2
          ORDER BY created_at DESC LIMIT 1`,
        [fingerprint, sinceDuplicate]
      );
      if (duplicate?.id) return { id: duplicate.id, created: false };

      await lock(sql, 'research_inquiry_global');
      await lock(sql, `research_inquiry_ip:${ipKey}`);
      await lock(sql, `research_inquiry_email:${emailKey}`);
      await lock(sql, `research_inquiry_attempt:${attemptKey}`);
      if (await countSince(sql, 'research_inquiry_global', 'all', new Date(deps.now().getTime() - limits.global.windowMs).toISOString()) >= limits.global.max) {
        throw new RateLimited();
      }
      if (await countSince(sql, 'research_inquiry_ip', ipKey, new Date(deps.now().getTime() - limits.ip.windowMs).toISOString()) >= limits.ip.max) {
        throw new RateLimited();
      }
      if (await countSince(sql, 'research_inquiry_email', emailKey, new Date(deps.now().getTime() - limits.email.windowMs).toISOString()) >= limits.email.max) {
        throw new RateLimited();
      }
      if (await countSince(sql, 'research_inquiry_attempt', attemptKey, new Date(deps.now().getTime() - limits.attempt.windowMs).toISOString()) >= limits.attempt.max) {
        throw new RateLimited();
      }
      await sql.query(
        `INSERT INTO ath_rate_events (bucket, rate_key, created_at) VALUES
          ('research_inquiry_global', 'all', $1),
          ('research_inquiry_ip', $2, $1),
          ('research_inquiry_email', $3, $1),
          ('research_inquiry_attempt', $4, $1)`,
        [at, ipKey, emailKey, attemptKey]
      );
      const inserted = await one<{ id: string }>(
        sql,
        `INSERT INTO ath_research_service_inquiries (
            idempotency_key, content_fingerprint, name, email, email_normalized, organization, role, vendor_count, message,
            notification_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $10)
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id::text AS id`,
        [request.idempotencyKey, fingerprint, value.name, value.email, email, value.organization, value.role, value.vendorCount, value.message, at]
      );
      if (inserted?.id) return { id: inserted.id, created: true };
      const raced = await one<{ id: string }>(
        sql,
        `SELECT id::text AS id FROM ath_research_service_inquiries WHERE idempotency_key = $1`,
        [request.idempotencyKey]
      );
      if (!raced?.id) throw new Error('insert_missing');
      return { id: raced.id, created: false };
    });
  } catch (error) {
    if (error instanceof RateLimited) {
      safeLog(deps, 'research_inquiry_rate_limited', { result: 'blocked' });
      return { ok: false, error: 'rate_limited' };
    }
    safeLog(deps, 'research_inquiry_unavailable', { reason: 'database' });
    return { ok: false, error: 'unavailable' };
  }

  if (stored.created) await deliverNotice(stored.id, value, deps);
  safeLog(deps, 'research_inquiry_stored', { result: stored.created ? 'created' : 'replay' });
  return { ok: true, stored: true, receiptId: stored.id };
}

class RateLimited extends Error {
  constructor() {
    super('rate_limited');
  }
}

async function consumeAttempt(
  deps: SubmitDeps,
  attemptKey: string,
  at: string,
  limit: { max: number; windowMs: number }
): Promise<'ok' | 'limited' | 'unavailable'> {
  try {
    return await deps.transaction(async (sql) => {
      await lock(sql, `research_inquiry_attempt:${attemptKey}`);
      const since = new Date(deps.now().getTime() - limit.windowMs).toISOString();
      if (await countSince(sql, 'research_inquiry_attempt', attemptKey, since) >= limit.max) return 'limited';
      await markAttempt(sql, attemptKey, at);
      return 'ok';
    });
  } catch {
    safeLog(deps, 'research_inquiry_unavailable', { reason: 'database' });
    return 'unavailable';
  }
}

async function deliverNotice(id: string, value: ResearchInquiryInput, deps: SubmitDeps) {
  let claimed = false;
  try {
    claimed = await deps.transaction(async (sql) => {
      const row = await one<{ id: string }>(
        sql,
        `UPDATE ath_research_service_inquiries
            SET notification_status = 'sending', notification_attempted_at = $2
          WHERE id = $1::uuid AND notification_status = 'pending'
          RETURNING id::text AS id`,
        [id, deps.now().toISOString()]
      );
      return Boolean(row?.id);
    });
  } catch {
    safeLog(deps, 'research_inquiry_notification', { result: 'claim_failed' });
    return;
  }
  if (!claimed) return;
  let delivered = false;
  let providerRef: string | null = null;
  let errorCode: 'unconfigured' | 'provider_rejected' | 'network' = 'network';
  try {
    const result = await deps.mailer(buildResearchInquiryNotice(id, value));
    delivered = result.delivered;
    providerRef = result.providerRef ?? null;
    if (!delivered) errorCode = result.errorCode ?? 'provider_rejected';
  } catch {
    delivered = false;
    errorCode = 'network';
  }
  try {
    await deps.transaction(async (sql) => {
      await sql.query(
        `UPDATE ath_research_service_inquiries
            SET notification_status = $2,
                notification_sent_at = CASE WHEN $2 = 'sent' THEN $3::timestamptz ELSE NULL END,
                notification_error_code = CASE WHEN $2 = 'sent' THEN NULL ELSE $4 END,
                provider_message_ref = $5
          WHERE id = $1::uuid AND notification_status = 'sending'`,
        [id, delivered ? 'sent' : 'failed', deps.now().toISOString(), delivered ? null : errorCode, providerRef]
      );
    });
  } catch {
    safeLog(deps, 'research_inquiry_notification', { result: 'status_update_failed' });
    return;
  }
  safeLog(deps, 'research_inquiry_notification', { result: delivered ? 'sent' : 'failed' });
}
