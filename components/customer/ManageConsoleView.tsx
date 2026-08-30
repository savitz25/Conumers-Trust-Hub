'use client';

import { useEffect } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

export function ManageConsoleView({ profileId }: { profileId: string }) {
  useEffect(() => trackEvent(ANALYTICS_EVENTS.MANAGE_CONSOLE_VIEW, { hub: 'contractor', profile_id: profileId }), [profileId]);
  return null;
}
