import * as Sentry from '@sentry/nextjs';
import { sentrySharedInitOptions } from './lib/sentry/options';
import { sentryClientDsn } from './lib/sentry/runtime';

const dsn = sentryClientDsn();
if (dsn) {
  Sentry.init({
    ...sentrySharedInitOptions(dsn),
    tracePropagationTargets: ['localhost', /^\//, /^https:\/\/(www\.)?asktrusthub\.com/],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
