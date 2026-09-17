import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
import type { TransactionEvent } from '@sentry/core';
import { scrubSentryBreadcrumb, scrubSentryEvent, type SentryLikeBreadcrumb, type SentryLikeEvent } from './privacy.ts';
import {
  sentryEnvironment,
  sentryRelease,
  sentryTracesSampleRate,
  shouldDropSentryTransaction,
} from './runtime.ts';

/** Conservative opt-out matching sendDefaultPii: false. Do not pass a partial object. */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  httpBodies: [],
  httpHeaders: { deny: ['authorization', 'cookie', 'set-cookie', 'forwarded', '-ip', 'remote-', 'via', '-user'] },
  cookies: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user', 'sb-', 'auth'] },
  urlQueryParams: {
    deny: ['q', 'query', 'question', 'email', 'token', 'code', 'password', 'note', 'notes', 'forwarded', '-ip'],
  },
};

export function sentrySharedInitOptions(dsn: string) {
  return {
    dsn,
    environment: sentryEnvironment(),
    release: sentryRelease(),
    sendDefaultPii: false,
    enableLogs: false,
    sendClientReports: true,
    dataCollection: SENTRY_DATA_COLLECTION,
    tracesSampler: ({
      name,
      inheritOrSampleWith,
    }: {
      name: string;
      inheritOrSampleWith: (fallbackRate: number) => number;
    }) => {
      if (shouldDropSentryTransaction(name)) return 0;
      return inheritOrSampleWith(sentryTracesSampleRate());
    },
    beforeSend(event: ErrorEvent) {
      return scrubSentryEvent(event as unknown as SentryLikeEvent) as unknown as ErrorEvent;
    },
    beforeSendTransaction(event: TransactionEvent) {
      return scrubSentryEvent(event as unknown as SentryLikeEvent) as unknown as TransactionEvent;
    },
    beforeBreadcrumb(breadcrumb: Breadcrumb) {
      return scrubSentryBreadcrumb(breadcrumb as SentryLikeBreadcrumb);
    },
    initialScope: {
      tags: {
        hub: 'ask',
      },
    },
  };
}
