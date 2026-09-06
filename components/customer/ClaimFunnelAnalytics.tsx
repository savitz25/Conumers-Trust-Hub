'use client';

import { useEffect } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import { claimAcquisitionSource, safeClaimFunnelProperties, type ClaimAcquisitionSource } from '@/lib/customer/claim-launch';

export function ClaimFunnelAnalytics({
  event,
  hub,
  profileClass,
  state,
  resultState,
  source,
  authenticated,
}: {
  event: string;
  hub?: string;
  profileClass?: string;
  state?: string;
  resultState?: string;
  source?: ClaimAcquisitionSource | string;
  authenticated?: boolean;
}) {
  useEffect(() => {
    trackEvent(event, safeClaimFunnelProperties({
      hub: hub as never,
      profileClass: profileClass as never,
      state,
      resultState,
      source: claimAcquisitionSource(source),
      authenticated,
    }));
  }, [authenticated,event,hub,profileClass,resultState,source,state]);
  return null;
}

export const CLAIM_FUNNEL_EVENTS = ANALYTICS_EVENTS;
