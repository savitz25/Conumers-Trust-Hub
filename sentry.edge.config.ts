import * as Sentry from '@sentry/nextjs';
import { sentrySharedInitOptions } from './lib/sentry/options';
import { sentryServerDsn } from './lib/sentry/runtime';

const dsn = sentryServerDsn();
if (dsn) {
  Sentry.init(sentrySharedInitOptions(dsn));
}
