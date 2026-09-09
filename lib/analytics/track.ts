import { track } from '@vercel/analytics';
import type { AnalyticsEventName } from '@/lib/analytics/events';

type Props = Record<string, string | number | boolean | null | undefined>;
const FIRST_PARTY_EVENTS = new Set(['claim_cta_clicked','claim_handoff_received','claim_auth_required','claim_auth_returned','claim_validation_started','claim_validation_failed','claim_started','claim_completed','claim_recovery_viewed','claim_review_requested','manage_business_opened','business_info_saved','business_info_reconfirmed','record_issue_submitted','business_reply_submitted','monitoring_enabled','my_trust_hub_viewed']);

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
    if (typeof window !== 'undefined' && FIRST_PARTY_EVENTS.has(name)) {
      void fetch(`/api/product-events?route=${encodeURIComponent(window.location.pathname)}`, {
        method: 'POST', headers: {'content-type':'application/json'}, keepalive: true,
        body: JSON.stringify({eventName:name,properties:cleaned}),
      }).catch(() => undefined);
    }
  } catch {
    // Measurement must never break UX
  }
}
