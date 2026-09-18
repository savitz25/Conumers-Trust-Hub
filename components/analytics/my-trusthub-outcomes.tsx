'use client';

/**
 * ATH-OBS-002D: emits My TrustHub SUCCESS / FAILURE events from outcomes the server confirmed.
 *
 * The server sets a bounded one-shot marker on its post-mutation redirect (e.g. `?handoff=saved`).
 * This component maps the marker to its canonical event, captures it once, then removes the marker
 * from the address bar so refresh / Back cannot count the same conversion twice. It does nothing
 * (and leaves the URL untouched) when PostHog is not enabled.
 */
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { shouldEnablePosthog } from '@/lib/analytics/environment';
import { captureTrustEvent } from '@/lib/analytics/trusthub';
import {
  CONTINUATION_REASON_STORAGE_KEY, MY_TRUSTHUB_EVENTS, createOnceGuard, decodeContinuationReason, encodeContinuationReason,
  resolveMyTrustHubOutcomes, stripConsumedMarkers,
} from '@/lib/analytics/my-trusthub-contract';

const once = createOnceGuard();

function readReason(): string | null {
  try { return decodeContinuationReason(window.localStorage.getItem(CONTINUATION_REASON_STORAGE_KEY), Date.now()); } catch { return null; }
}

export function MyTrustHubOutcomes() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      if (!shouldEnablePosthog() || !pathname?.startsWith('/my')) return;
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      const outcomes = resolveMyTrustHubOutcomes(pathname, params, { continuationReason: readReason() });
      if (!outcomes.length) return;
      const consumed: string[] = [];
      for (const outcome of outcomes) {
        consumed.push(...outcome.consumeParams);
        if (!once(`${outcome.event}|${pathname}?${params.toString()}`)) continue;
        captureTrustEvent(outcome.event, outcome.properties);
        try {
          if (outcome.event === MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_STARTED && outcome.properties.continuation_reason) {
            const encoded = encodeContinuationReason(outcome.properties.continuation_reason, Date.now());
            if (encoded) window.localStorage.setItem(CONTINUATION_REASON_STORAGE_KEY, encoded);
          }
          if (outcome.event === MY_TRUSTHUB_EVENTS.AUTH_CONTINUATION_COMPLETED) window.localStorage.removeItem(CONTINUATION_REASON_STORAGE_KEY);
        } catch { /* storage unavailable: attribution falls back to "direct" */ }
      }
      const next = `${pathname}${stripConsumedMarkers(window.location.search, consumed)}`;
      window.history.replaceState(window.history.state, '', next);
    } catch {
      // Observability must never break product flows.
    }
  }, [pathname, searchParams]);

  return null;
}
