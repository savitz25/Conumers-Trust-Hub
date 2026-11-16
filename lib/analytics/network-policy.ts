import { posthogHost, shouldEnablePosthog } from './environment.ts';

/**
 * Enforced document Content-Security-Policy.
 *
 * default-src 'none' is the baseline. Every resource class used by the app is
 * named below. An omitted class cannot fall through to an open default.
 * PostHog, Google Analytics, and Google Tag Manager stay off every class while
 * their gates are closed. The header is Content-Security-Policy, not report-only.
 *
 * script-src and style-src include 'unsafe-inline' because the App Router and
 * Tailwind emit build-specific inline styles and bootstrap scripts, and this
 * app does not stamp a per-request nonce. Neither directive includes 'unsafe-eval'.
 * 'unsafe-inline' does not allow an external analytics host.
 *
 * form-action includes the Contractor save handoff because /my/handoff/prepare
 * posts there. That route also sets its own narrower policy for the one document.
 * CSP matches origins, not paths. 'self' cannot exclude /api/analytics/identity.
 * No proxy rewrite exists. The identity route has its own server-side gate.
 */
export const ENFORCED_CSP_HEADER = 'Content-Security-Policy';

export const FIRST_PARTY_ANALYTICS_PATHS = ['/api/analytics/identity'] as const;

export const ABSENT_ANALYTICS_HOSTS = [
  'posthog.com',
  'i.posthog.com',
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'doubleclick.net',
] as const;

type PolicyOptions = {
  posthogOpen: boolean;
  posthogHost: string;
  googleAnalyticsOpen: boolean;
  includeTurnstile: boolean;
  includeGoogleIdentity: boolean;
  includeJsdelivr: boolean;
  /** Exact https origins for a real cross-origin form. Empty means 'self' only. */
  formActionOrigins?: readonly string[];
};

function httpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function posthogAssetOrigins(host: string): string[] {
  const origin = httpsOrigin(host);
  if (!origin) return [];
  const sources = [origin];
  try {
    const hostname = new URL(origin).hostname;
    const region = hostname.endsWith('.i.posthog.com') ? hostname.split('.')[0] : '';
    if (region === 'us' || region === 'eu') sources.push(`https://${region}-assets.i.posthog.com`);
  } catch {
    return sources;
  }
  return sources;
}

function unique(sources: readonly string[]): string[] {
  return [...new Set(sources)];
}

export function buildAnalyticsContentSecurityPolicy(options: PolicyOptions): string {
  const connect = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://*.sentry.io',
    'https://*.ingest.sentry.io',
    'https://vitals.vercel-insights.com',
  ];
  const script = ["'self'", "'unsafe-inline'", 'https://va.vercel-scripts.com'];
  const worker = ["'self'", 'blob:'];
  const frame = ["'self'"];
  const image = ["'self'", 'data:', 'blob:', 'https://*.supabase.co'];
  const form = ["'self'", ...(options.formActionOrigins ?? [])];

  if (options.includeTurnstile) {
    connect.push('https://challenges.cloudflare.com');
    script.push('https://challenges.cloudflare.com');
    frame.push('https://challenges.cloudflare.com');
  }
  if (options.includeGoogleIdentity) {
    connect.push('https://accounts.google.com');
    script.push('https://accounts.google.com');
    frame.push('https://accounts.google.com');
  }
  if (options.includeJsdelivr) {
    connect.push('https://cdn.jsdelivr.net');
    script.push('https://cdn.jsdelivr.net');
    worker.push('https://cdn.jsdelivr.net');
  }
  if (options.googleAnalyticsOpen) {
    connect.push('https://www.google-analytics.com', 'https://analytics.google.com', 'https://stats.g.doubleclick.net');
    script.push('https://www.googletagmanager.com');
    image.push('https://www.google-analytics.com', 'https://analytics.google.com', 'https://stats.g.doubleclick.net');
  }
  if (options.posthogOpen) {
    for (const source of posthogAssetOrigins(options.posthogHost)) {
      connect.push(source);
      script.push(source);
    }
  }

  const frames = unique(frame);
  const workers = unique(worker);
  return [
    "default-src 'none'",
    `connect-src ${unique(connect).join(' ')}`,
    `script-src ${unique(script).join(' ')}`,
    `script-src-elem ${unique(script).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${unique(image).join(' ')}`,
    "font-src 'self'",
    `frame-src ${frames.join(' ')}`,
    `child-src ${unique([...frames, ...workers]).join(' ')}`,
    `worker-src ${workers.join(' ')}`,
    `form-action ${unique(form).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "media-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}

/** Closed unless the same fail-closed gate used by the client is open. */
export function enforcedDocumentContentSecurityPolicy(): string {
  const posthogOpen = shouldEnablePosthog();
  return buildAnalyticsContentSecurityPolicy({
    posthogOpen,
    posthogHost: posthogOpen ? posthogHost() : '',
    googleAnalyticsOpen: false,
    includeTurnstile: true,
    includeGoogleIdentity: false,
    includeJsdelivr: false,
    formActionOrigins: ['https://www.contractortrusthub.com'],
  });
}
