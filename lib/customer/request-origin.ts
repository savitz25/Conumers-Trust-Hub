/**
 * ATH-CLAIM-V2-001 — same-origin protection for state-changing claim requests.
 *
 * A browser sends `Origin` on every POST (form or fetch). Modern browsers also send `Sec-Fetch-Site`.
 * We accept a request only when at least one of them proves same-origin; anything else fails closed.
 * Pure function: no Next.js imports so it can be tested without a server.
 */
export type OriginCheck = { ok: true } | { ok: false; reason: 'missing_origin' | 'cross_origin' | 'cross_site_fetch' };

export function checkSameOrigin(headers: Headers, requestUrl: string, allowedOrigins: readonly string[] = []): OriginCheck {
  const expected = safeOrigin(requestUrl);
  const allowed = new Set([expected, ...allowedOrigins.map(safeOrigin)].filter(Boolean));
  const origin = headers.get('origin');
  const fetchSite = headers.get('sec-fetch-site');
  if (origin) {
    return allowed.has(safeOrigin(origin)) ? { ok: true } : { ok: false, reason: 'cross_origin' };
  }
  if (fetchSite) {
    return fetchSite === 'same-origin' ? { ok: true } : { ok: false, reason: 'cross_site_fetch' };
  }
  return { ok: false, reason: 'missing_origin' };
}

function safeOrigin(value: string): string {
  try { return new URL(value).origin; } catch { return ''; }
}
