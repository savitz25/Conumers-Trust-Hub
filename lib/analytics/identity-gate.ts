import { isOpaqueTrustHubId } from './privacy.ts';

/**
 * Safe body when analytics is disabled or consent is unresolved.
 * distinctId stays null. No account identifier is derived.
 */
export const INACTIVE_ANALYTICS_IDENTITY = { distinctId: null, analytics: 'inactive' } as const;

export type AnalyticsIdentityBody =
  | typeof INACTIVE_ANALYTICS_IDENTITY
  | { distinctId: string | null };

/**
 * Server decision for /api/analytics/identity.
 * A closed gate returns the inactive body and does not read session.id.
 */
export function analyticsIdentityForSession(
  enabled: boolean,
  session: { id: string | null },
): AnalyticsIdentityBody {
  if (!enabled) return INACTIVE_ANALYTICS_IDENTITY;
  if (session.id && isOpaqueTrustHubId(session.id)) return { distinctId: session.id };
  return { distinctId: null };
}
