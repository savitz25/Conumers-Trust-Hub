import { clientIp } from '../customer/client-ip.ts';
import {
  researchInquiryPayloadBlocked,
  type ResearchInquiryInput,
} from './inquiry.ts';
import { submitResearchInquiry, type SubmitDeps, type SubmitResult } from './submit.ts';

const MAX_BODY = 8_000;

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

export function handleResearchInquiryRead(): Response {
  return json({ ok: false, error: 'not_found' }, 404);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function textField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function handleResearchInquiryPost(request: Request, deps: SubmitDeps): Promise<Response> {
  if (!sameOrigin(request)) return json({ ok: false, error: 'rejected' }, 403);
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return json({ ok: false, error: 'rejected' }, 415);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: 'payload_too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'invalid', fields: {} }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'rejected' }, 400);
  const record = body as Record<string, unknown>;
  if (researchInquiryPayloadBlocked(record)) return json({ ok: false, error: 'rejected' }, 400);
  const input: ResearchInquiryInput = {
    name: textField(record.name),
    email: textField(record.email),
    organization: textField(record.organization),
    role: textField(record.role),
    vendorCount: textField(record.vendorCount),
    message: textField(record.message),
  };
  const result = await submitResearchInquiry(
    {
      idempotencyKey: textField(record.idempotencyKey),
      honeypot: textField(record.company_website_leave_blank),
      input,
      ip: clientIp(request.headers),
    },
    deps
  );
  return json(publicResult(result), statusFor(result));
}

function publicResult(result: SubmitResult): SubmitResult {
  if (result.ok) return { ok: true, stored: true, receiptId: result.receiptId };
  if (result.error === 'invalid') return { ok: false, error: 'invalid', fields: result.fields };
  return { ok: false, error: result.error };
}

function statusFor(result: SubmitResult): number {
  if (result.ok) return 200;
  if (result.error === 'rate_limited') return 429;
  if (result.error === 'unavailable') return 503;
  return 400;
}
