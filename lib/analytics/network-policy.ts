import { posthogHost, shouldEnablePosthog } from './environment.ts';

/**
 * Response Content-Security-Policy for inactive analytics.
 *
 * connect-src and script-src are allowlists. PostHog, its asset hosts, and any
 * SDK-configured collector that is not the page origin are omitted, so the
 * browser rejects them before a script runs. This header is Content-Security-Policy,
 * not Content-Security-Policy-Report-Only.
 *
 * script-src includes 'unsafe-inline' because the App Router emits build-specific
 * inline bootstrap scripts and this app does not stamp a per-request nonce.
 * It does not include 'unsafe-eval'. Inline scripts can still run; they cannot
 * connect to a host outside connect-src.
 *
 * CSP matches origins, not paths. 'self' cannot exclude /api/analytics/identity
 * or a same-origin PostHog proxy. No proxy rewrite exists. The client does not
 * call the identity route unless automatic identity and the full gate are on.
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

  if (options.includeTurnstile) {
    connect.push('https://challenges.cloudflare.com');
    script.push('https://challenges.cloudflare.com');
  }
  if (options.includeGoogleIdentity) {
    connect.push('https://accounts.google.com');
    script.push('https://accounts.google.com');
  }
  if (options.includeJsdelivr) {
    connect.push('https://cdn.jsdelivr.net');
    script.push('https://cdn.jsdelivr.net');
    worker.push('https://cdn.jsdelivr.net');
  }
  if (options.googleAnalyticsOpen) {
    connect.push('https://www.google-analytics.com', 'https://analytics.google.com', 'https://stats.g.doubleclick.net');
    script.push('https://www.googletagmanager.com');
  }
  if (options.posthogOpen) {
    for (const source of posthogAssetOrigins(options.posthogHost)) {
      connect.push(source);
      script.push(source);
    }
  }

  return [
    `connect-src ${connect.join(' ')}`,
    `script-src ${script.join(' ')}`,
    `worker-src ${worker.join(' ')}`,
    "base-uri 'self'",
    "object-src 'none'",
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
  });
}
