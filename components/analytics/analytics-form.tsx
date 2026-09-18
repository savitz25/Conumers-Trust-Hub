'use client';

import type { FormHTMLAttributes, ReactNode } from 'react';
import { captureGuestImportSaveIntent, captureProfileSaveIntent, captureSignupStarted } from '@/components/analytics/ask-instrumentation';

/**
 * Submit-time INTENT events only (ATH-OBS-002D). Success and failure are never emitted from a
 * submit handler: the server has not confirmed anything yet.
 */
const EVENTS = {
  account_signup_started: () => captureSignupStarted('my_sign_in'),
  profile_save_intent: () => captureProfileSaveIntent(),
  guest_import_save_intent: (form: HTMLFormElement) => captureGuestImportSaveIntent(Boolean(new FormData(form).get('projectId'))),
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
      EVENTS[analyticsEvent](event.currentTarget);
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
