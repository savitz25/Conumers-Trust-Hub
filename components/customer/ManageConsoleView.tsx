'use client';

import { useEffect } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

export function ManageConsoleView({ hub }: { hub: string }) {
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.MANAGE_CONSOLE_VIEW, { hub });
    trackEvent(ANALYTICS_EVENTS.MANAGE_BUSINESS_OPENED, { hub });
  }, [hub]);
  return null;
}
