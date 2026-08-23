import { track } from '@vercel/analytics';
import type { AnalyticsEventName } from '@/lib/analytics/events';

type Props = Record<string, string | number | boolean | null | undefined>;

/**
 * Fire a Vercel Analytics custom event. Safe no-op if Analytics is unavailable.
 */
export function trackEvent(name: AnalyticsEventName | string, props?: Props): void {
  try {
    const cleaned: Record<string, string | number | boolean> = {};
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined) continue;
        cleaned[key] = value;
      }
    }
    track(name, cleaned);
    if (typeof window !== 'undefined') {
      const row = { name, props: cleaned };
      const g = window as Window & { __askSearchEvents?: Array<typeof row> };
      g.__askSearchEvents = g.__askSearchEvents || [];
      g.__askSearchEvents.push(row);
      try {
        const prev = JSON.parse(sessionStorage.getItem('__askSearchEvents') || '[]') as typeof g.__askSearchEvents;
        prev.push(row);
        sessionStorage.setItem('__askSearchEvents', JSON.stringify(prev));
      } catch {
        /* private mode / quota must never break UX */
      }
    }
  } catch {
    // Measurement must never break UX
  }
}
