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

export function shouldEnablePosthog(): boolean {
  if (analyticsEnvironment() !== 'production') return false;
  if (!posthogProjectToken() || !posthogHost()) return false;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
    if (navigator.webdriver) return false;
  }
  return true;
}
