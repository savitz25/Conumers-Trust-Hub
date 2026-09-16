'use client';

import { useEffect } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import { captureTrustEvent } from '@/lib/analytics/trusthub';
import { TRUSTHUB_EVENTS } from '@/lib/analytics/trusthub-events';
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
    const props = safeClaimFunnelProperties({
      hub: hub as never,
      profileClass: profileClass as never,
      state,
      resultState,
      source: claimAcquisitionSource(source),
      authenticated,
    });
    trackEvent(event, props);
    if (event === 'claim_started') {
      captureTrustEvent(TRUSTHUB_EVENTS.CLAIM_STARTED, {
        surface: 'claim',
        specialist_hub: hub,
        state,
        authenticated,
        success: true,
      });
    }
  }, [authenticated,event,hub,profileClass,resultState,source,state]);
  return null;
}

export const CLAIM_FUNNEL_EVENTS = ANALYTICS_EVENTS;
