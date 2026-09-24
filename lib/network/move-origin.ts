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
// This project's Move preview deployments only. A new Vercel deployment id on
// move-trust-*-savitz25-s-projects.vercel.app stays allowlisted; other teams and
// arbitrary *.vercel.app hosts do not.
const MOVE_PROJECT_PREVIEW_ORIGIN = /^https:\/\/move-trust-[a-z0-9-]+-savitz25-s-projects\.vercel\.app$/;

function allowlistedMoveOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  // Compare the supplied origin before URL normalization can erase path segments,
  // backslashes, credentials or encoded hostname characters. One trailing / is OK.
  const origin = value.endsWith('/') ? value.slice(0, -1) : value;
  if (origin === PRODUCTION_MOVE_ORIGIN || origin === 'https://movetrusthub.com') return PRODUCTION_MOVE_ORIGIN;
  if (MOVE_PROJECT_PREVIEW_ORIGIN.test(origin)) return origin;
  if (process.env.NODE_ENV === 'development'
    && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/.test(origin)) {
    try { return new URL(origin).origin; } catch { return null; }
  }
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
