import * as Sentry from '@sentry/nextjs';
import { sentrySharedInitOptions } from './lib/sentry/options';
import { sentryClientDsn } from './lib/sentry/runtime';
import { installAnalyticsTransportGuard } from './lib/analytics/sdk-guard';

if (typeof window !== 'undefined') installAnalyticsTransportGuard();

const dsn = sentryClientDsn();
if (dsn) {
  Sentry.init({
    ...sentrySharedInitOptions(dsn),
    tracePropagationTargets: ['localhost', /^\//, /^https:\/\/(www\.)?asktrusthub\.com/],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
