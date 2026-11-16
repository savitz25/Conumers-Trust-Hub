export type AnalyticsEnvironment = 'production' | 'preview' | 'development';

export function analyticsEnvironment(): AnalyticsEnvironment {
  const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV;
  if (vercel === 'production') return 'production';
  if (vercel === 'preview') return 'preview';
  return 'development';
}

export function posthogProjectToken(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || '').trim();
}

export function posthogHost(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST || '').trim();
}

export type AnalyticsConsent = 'granted' | 'denied' | 'unresolved';

/**
 * Automatic capture stays off until a reviewed code change turns a flag on.
 * These are not environment variables and a missing consent banner is not a grant.
 */
export const AUTOMATIC_PAGEVIEW_CAPTURE = false;
export const AUTOMATIC_IDENTITY_COLLECTION = false;

/**
 * Ask has no reviewed analytics-consent record. The absence of a banner is unresolved,
 * not a grant. Do not read this as a legal conclusion about whether consent is required.
 */
export function analyticsConsent(): AnalyticsConsent {
  return 'unresolved';
}

/** Do Not Track, Global Privacy Control, or cookies turned off. */
export function analyticsBrowserOptOut(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    const dnt = navigator.doNotTrack;
    if (dnt === '1' || dnt === 'yes') return true;
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    if (gpc === true) return true;
    return navigator.cookieEnabled === false;
  } catch {
    return false;
  }
}

/**
 * Fail closed. Consent defaults to unresolved. The activation switch must be the
 * exact string "enabled" with no trim and no case fold. A project token alone does nothing.
 */
export function shouldEnablePosthog(consent: AnalyticsConsent = analyticsConsent()): boolean {
  try {
    if (consent !== 'granted') return false;
    if (analyticsEnvironment() !== 'production') return false;
    if (!posthogProjectToken() || !posthogHost()) return false;
    if (process.env.NEXT_PUBLIC_POSTHOG_ACTIVATION !== 'enabled') return false;
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
      if (navigator.webdriver) return false;
    }
    if (analyticsBrowserOptOut()) return false;
    return true;
  } catch {
    return false;
  }
}
