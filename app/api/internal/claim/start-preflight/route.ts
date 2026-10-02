import { NextResponse } from 'next/server';
import { withPlatform } from '@/lib/customer/server';
import { customerLog } from '@/lib/customer/log';
import { CLAIM_START_PREFLIGHT_MAX_BODY, verifyClaimStartPreflight, type ClaimStartPreflightDecision } from '@/lib/customer/claim-start-preflight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } as const;

/**
 * ATH-CLAIM-V2-FLNJ-001R1 — server-to-server only. A browser cannot produce the domain-separated HMAC, so
 * unsigned or mis-signed calls are refused before any database work. Responses carry bounded machine state only.
 */
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST', ...NO_STORE } });
}

function reply(decision: ClaimStartPreflightDecision | { allowed: false; reason: 'unauthorized' | 'malformed' | 'stale' | 'unavailable' }, status: number) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (!decision.allowed && 'retryAfterSeconds' in decision && decision.retryAfterSeconds > 0) headers['Retry-After'] = String(decision.retryAfterSeconds);
  return NextResponse.json(decision, { status, headers });
}

export async function POST(request: Request) {
  const raw = await request.text().catch(() => '');
  if (raw.length > CLAIM_START_PREFLIGHT_MAX_BODY) return reply({ allowed: false, reason: 'malformed' }, 400);
  const verified = verifyClaimStartPreflight(process.env.ATH_HANDOFF_SECRET || '', raw, request.headers.get('x-ath-preflight-signature'));
  if (!verified.ok) {
    customerLog('claim_start_preflight_rejected', { code: verified.code }, 'warn');
    if (verified.code === 'bad_signature' || verified.code === 'misconfigured') return reply({ allowed: false, reason: 'unauthorized' }, 401);
    return reply({ allowed: false, reason: verified.code }, 400);
  }
  try {
    const decision = await withPlatform((p) => p.claimStartPreflight({ bucketDigest: verified.request.bucket, profileId: verified.request.profileId, requestId: verified.request.rid }));
    customerLog('claim_start_preflight', { allowed: decision.allowed, reason: decision.reason });
    return reply(decision, decision.allowed ? 200 : 429);
  } catch {
    customerLog('claim_start_preflight_failed', {}, 'error');
    return reply({ allowed: false, reason: 'unavailable' }, 503);
  }
}
