'use client';

import type { FormHTMLAttributes, ReactNode } from 'react';

export function AnalyticsForm({
  onAnalyticsSubmit,
  onSubmit,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  onAnalyticsSubmit?: () => void;
  children: ReactNode;
}) {
  function handleSubmit(event: Parameters<NonNullable<FormHTMLAttributes<HTMLFormElement>['onSubmit']>>[0]) {
    try {
      onAnalyticsSubmit?.();
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
