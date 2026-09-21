/**
 * Preview Move specialist handoff origin.
 *
 * Production Ask builds keep https://www.movetrusthub.com unless
 * NEXT_PUBLIC_MOVE_ORIGIN is an allowlisted origin. Setting that variable to
 * the production origin is a no-op. Path, query, and hash on an existing Move
 * handoff stay intact so journey and attribution context is not dropped.
 */

export const PRODUCTION_MOVE_ORIGIN = 'https://www.movetrusthub.com';

const PRODUCTION_MOVE_HOSTS = new Set(['www.movetrusthub.com', 'movetrusthub.com']);

function allowlistedMoveOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  const preview = host.endsWith('.vercel.app');
  const production = PRODUCTION_MOVE_HOSTS.has(host);
  if (production && url.protocol === 'https:') return PRODUCTION_MOVE_ORIGIN;
  if (preview && url.protocol === 'https:') return url.origin;
  if (local && (url.protocol === 'http:' || url.protocol === 'https:')) return url.origin;
  return null;
}

/** Configured Move origin for specialist handoffs. Production mapping is the default. */
export function moveOrigin(): string {
  return allowlistedMoveOrigin(process.env.NEXT_PUBLIC_MOVE_ORIGIN) ?? PRODUCTION_MOVE_ORIGIN;
}

/** Retarget a production Move handoff onto the configured origin. Other URLs are unchanged. */
export function rewriteMoveSpecialistHref(href: string): string {
  const origin = moveOrigin();
  if (origin === PRODUCTION_MOVE_ORIGIN) return href;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return href;
  if (!PRODUCTION_MOVE_HOSTS.has(url.hostname.toLowerCase())) return href;
  const target = new URL(origin);
  url.protocol = target.protocol;
  url.hostname = target.hostname;
  url.port = target.port;
  return url.toString();
}
