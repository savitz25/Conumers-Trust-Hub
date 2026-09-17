'use client';

import { useEffect } from 'react';
import {
  ANALYTICS_EVENTS,
  hubIdFromHostname,
  internalNavKeyFromPath,
} from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';
import { captureResultOpened, captureSearchSubmitted, captureSpecialistHandoff } from '@/components/analytics/ask-instrumentation';
import { classifyAskClick } from '@/lib/analytics/handoff';

/**
 * Document-level click instrumentation for outbound specialist hubs and
 * key knowledge-layer internal destinations.
 */
export function ClickTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 && event.button !== 1) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const instrumented = target.closest<HTMLElement>('[data-analytics-event]');
      const namedEvent = instrumented?.dataset.analyticsEvent;
      if (namedEvent) {
        trackEvent(namedEvent, { surface: 'homepage' });
      }

      const anchor = target.closest('a');
      const href = anchor instanceof HTMLAnchorElement ? anchor.getAttribute('href') : null;
      const ath = target.closest<HTMLElement>('[data-ath-event]');
      const classified = classifyAskClick({
        href,
        currentOrigin: window.location.origin,
        athEvent: ath?.dataset.athEvent,
        athHub: ath?.dataset.athHub,
        athSurface: ath?.dataset.athSurface,
      });
      if (classified.searchResultOpened) {
        captureResultOpened(classified.searchResultOpened.specialistHub, classified.searchResultOpened.surface);
      }
      if (classified.specialistHandoff) {
        captureSpecialistHandoff(classified.specialistHandoff.specialistHub, classified.specialistHandoff.surface);
      }

      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      try {
        const url = new URL(href, window.location.origin);

        if (url.origin !== window.location.origin) {
          const hub = hubIdFromHostname(url.hostname);
          if (hub) {
            trackEvent(ANALYTICS_EVENTS.OUTBOUND_HUB, {
              hub,
              path: url.pathname,
            });
          }
          return;
        }

        if (url.pathname === '/ask' && url.searchParams.has('q')) {
          captureSearchSubmitted('ask_example_link');
        }

        const navKey = internalNavKeyFromPath(url.pathname);
        if (navKey) {
          trackEvent(ANALYTICS_EVENTS.INTERNAL_NAV, {
            destination: navKey,
            path: url.pathname,
          });
        }
      } catch {
        // ignore malformed hrefs
      }
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
