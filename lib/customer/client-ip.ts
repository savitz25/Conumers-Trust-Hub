import { isIP } from 'node:net';

/**
 * ATH-CLAIM-V2-001R4 — client address for abuse rate-limit keys and audit context ONLY. Never an identity or
 * authentication claim. Mirrors Contractor's ATH-CLAIM-V2-001R3 hardening (lib/claim/start-core.ts clientIp):
 *
 * - `x-vercel-forwarded-for` is set by Vercel's edge from the connecting peer. Whenever it is present it is
 *   authoritative; a malformed value degrades to the shared 'unknown' bucket, never to a client-settable header.
 * - In a Vercel runtime (`VERCEL=1`) that header is always expected, so its absence also yields 'unknown' rather
 *   than trusting a client-supplied `x-forwarded-for`.
 * - Outside Vercel (local dev, tests) the conventional `x-forwarded-for` / `x-real-ip` fallback applies.
 * - Every candidate is length-bounded and validated as IPv4/IPv6 before use.
 */
const MAX_FORWARDED_HEADER_LENGTH = 512;
const MAX_IP_TEXT_LENGTH = 45;

function normalizeAddressCandidate(value: string): string {
  const trimmed = value.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(trimmed);
  return (bracketed ? bracketed[1] : trimmed).slice(0, MAX_IP_TEXT_LENGTH);
}

function firstValidAddress(headerValue: string): string | null {
  if (!headerValue) return null;
  const first = headerValue.slice(0, MAX_FORWARDED_HEADER_LENGTH).split(',', 1)[0];
  if (!first) return null;
  const candidate = normalizeAddressCandidate(first);
  return candidate.length > 0 && isIP(candidate) !== 0 ? candidate : null;
}

export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  const vercelForwardedFor = headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor !== null) return firstValidAddress(vercelForwardedFor) ?? 'unknown';
  if (env.VERCEL === '1') return 'unknown';
  const forwardedFor = headers.get('x-forwarded-for');
  const fromForwardedFor = forwardedFor !== null ? firstValidAddress(forwardedFor) : null;
  if (fromForwardedFor) return fromForwardedFor;
  const realIp = headers.get('x-real-ip');
  return (realIp !== null ? firstValidAddress(realIp) : null) ?? 'unknown';
}
