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
  } catch {
    // Measurement must never break UX
  }
}
