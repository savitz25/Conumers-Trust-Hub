'use client';

import { useEffect } from 'react';
import {
  ANALYTICS_EVENTS,
  hubIdFromHostname,
  internalNavKeyFromPath,
} from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

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

      const anchor = target.closest('a');
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href');
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
