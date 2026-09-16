'use client';

import type { FormHTMLAttributes, ReactNode } from 'react';
import { captureProfileSaved, captureProjectCreated, captureSignupStarted } from '@/components/analytics/ask-instrumentation';

const EVENTS = {
  account_signup_started: () => captureSignupStarted('my_sign_in'),
  project_created: () => captureProjectCreated('my_projects'),
  profile_saved: () => captureProfileSaved('my_saved'),
} as const;

export function AnalyticsForm({
  analyticsEvent,
  onSubmit,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  analyticsEvent: keyof typeof EVENTS;
  children: ReactNode;
}) {
  function handleSubmit(event: Parameters<NonNullable<FormHTMLAttributes<HTMLFormElement>['onSubmit']>>[0]) {
    try {
      EVENTS[analyticsEvent]();
    } catch {
      // analytics must not block submit
    }
    onSubmit?.(event);
  }
  return (
    <form {...props} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
