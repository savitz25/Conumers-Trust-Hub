import { analyticsEnvironment, type AnalyticsEnvironment } from '../analytics/environment.ts';

export function sentryClientDsn(): string {
  return (process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim();
}

export function sentryServerDsn(): string {
  return (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim();
}

export function sentryRelease(): string | undefined {
  const sha = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.SENTRY_RELEASE ||
    ''
  ).trim();
  return sha || undefined;
}

export function sentryEnvironment(): AnalyticsEnvironment {
  return analyticsEnvironment();
}

/** Production stays well below 100%. Preview is sampled; local/dev is full. */
export function sentryTracesSampleRate(env: AnalyticsEnvironment = sentryEnvironment()): number {
  if (env === 'production') return 0.1;
  if (env === 'preview') return 0.25;
  return 1;
}

export function shouldDropSentryTransaction(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('/sentry-tunnel') ||
    lower.includes('/monitoring') ||
    lower.includes('/api/cron') ||
    lower.includes('healthcheck') ||
    lower.includes('/health')
  );
}
