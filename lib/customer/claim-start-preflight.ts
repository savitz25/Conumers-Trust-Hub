/**
 * ATH-CLAIM-V2-FLNJ-001R1 — durable, cross-isolate claim-start preflight (Ask-hosted).
 *
 * ContractorTrustHub calls `POST /api/internal/claim/start-preflight` server-to-server BEFORE minting a signed
 * handoff. The request is authenticated with the shared ATH_HANDOFF_SECRET under a NEW domain-separated HMAC
 * message (never the handoff-token message), carries only an opaque keyed client-bucket digest (never an IP),
 * and is admitted or refused against `ath_rate_events` inside one serialized transaction. Pure module.
 */
import { hmacSha256, timingSafeEqualText } from './crypto.ts';

export const CLAIM_START_PREFLIGHT_DOMAIN = 'ATH_CLAIM_START_PREFLIGHT_V1';
/** Contractor derives `hmac(secret, "<domain>:<bucket>")` and sends only that. Ask never sees the bucket. */
export const CLAIM_START_BUCKET_DOMAIN = 'ATH_CLAIM_START_BUCKET_V1';
export const CLAIM_START_PREFLIGHT_MAX_BODY = 1024;
export const CLAIM_START_PREFLIGHT_WINDOW_SECONDS = 60;
export const MIN_PREFLIGHT_SECRET_LENGTH = 32;

/** Same numbers as Contractor's local (per-isolate) policy, enforced durably across isolates. */
export const CLAIM_START_DURABLE_POLICY = {
  perBucket: { max: 5, windowMs: 15 * 60 * 1000 },
  perBucketProfile: { max: 3, windowMs: 15 * 60 * 1000 },
  perBucketHourly: { max: 20, windowMs: 60 * 60 * 1000 },
  replayWindowMs: 2 * 60 * 1000,
  retryAfterSeconds: 900,
} as const;

export type ClaimStartPreflightRequest = { v: 1; ts: number; rid: string; bucket: string; profileId: string };
export type ClaimStartPreflightReason = 'ok' | 'per_bucket' | 'per_bucket_profile' | 'per_bucket_hourly' | 'replay' | 'unauthorized' | 'malformed' | 'stale' | 'unavailable';
export type ClaimStartPreflightDecision = { allowed: true; reason: 'ok' } | { allowed: false; reason: Exclude<ClaimStartPreflightReason, 'ok'>; retryAfterSeconds: number };
export type ClaimStartPreflightVerify = { ok: true; request: ClaimStartPreflightRequest } | { ok: false; code: 'misconfigured' | 'bad_signature' | 'malformed' | 'stale' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RID = /^[A-Za-z0-9_-]{16,64}$/;
const DIGEST = /^[A-Za-z0-9_-]{43}$/;

export function opaqueClaimStartBucket(secret: string, bucket: string): string {
  return hmacSha256(secret, `${CLAIM_START_BUCKET_DOMAIN}:${bucket}`);
}

export function signClaimStartPreflight(secret: string, rawBody: string): string {
  if (!secret || secret.length < MIN_PREFLIGHT_SECRET_LENGTH) throw new Error('preflight_secret_misconfigured');
  return hmacSha256(secret, `${CLAIM_START_PREFLIGHT_DOMAIN}:${rawBody}`);
}

/** Signature is checked over the exact raw body BEFORE any parsing; nothing here touches a database. */
export function verifyClaimStartPreflight(secret: string, rawBody: unknown, signature: unknown, now: Date = new Date()): ClaimStartPreflightVerify {
  if (!secret || secret.length < MIN_PREFLIGHT_SECRET_LENGTH) return { ok: false, code: 'misconfigured' };
  if (typeof rawBody !== 'string' || rawBody.length === 0 || rawBody.length > CLAIM_START_PREFLIGHT_MAX_BODY) return { ok: false, code: 'malformed' };
  if (typeof signature !== 'string' || signature.length === 0 || signature.length > 128) return { ok: false, code: 'bad_signature' };
  if (!timingSafeEqualText(signature, hmacSha256(secret, `${CLAIM_START_PREFLIGHT_DOMAIN}:${rawBody}`))) return { ok: false, code: 'bad_signature' };
  let parsed: Partial<ClaimStartPreflightRequest>;
  try { parsed = JSON.parse(rawBody) as Partial<ClaimStartPreflightRequest>; } catch { return { ok: false, code: 'malformed' }; }
  if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return { ok: false, code: 'malformed' };
  if (typeof parsed.ts !== 'number' || !Number.isInteger(parsed.ts)) return { ok: false, code: 'malformed' };
  if (typeof parsed.rid !== 'string' || !RID.test(parsed.rid)) return { ok: false, code: 'malformed' };
  if (typeof parsed.bucket !== 'string' || !DIGEST.test(parsed.bucket)) return { ok: false, code: 'malformed' };
  if (typeof parsed.profileId !== 'string' || !UUID.test(parsed.profileId)) return { ok: false, code: 'malformed' };
  if (Math.abs(Math.floor(now.getTime() / 1000) - parsed.ts) > CLAIM_START_PREFLIGHT_WINDOW_SECONDS) return { ok: false, code: 'stale' };
  return { ok: true, request: { v: 1, ts: parsed.ts, rid: parsed.rid, bucket: parsed.bucket, profileId: parsed.profileId.toLowerCase() } };
}
