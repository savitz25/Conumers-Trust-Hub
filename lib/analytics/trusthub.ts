'use client';

import { analyticsEnvironment, shouldEnablePosthog } from './environment';
import { getPosthogBrowser } from './posthog-browser';
import { isOpaqueTrustHubId, sanitizeAnalyticsUrl, stripForbiddenProperties } from './privacy';
import { TRUSTHUB_HUB, type TrustHubEventName, type TrustHubEventProperties } from './trusthub-events';

export function commonTrustHubProperties(
  extra?: Partial<TrustHubEventProperties>,
): Record<string, string | number | boolean> {
  return stripForbiddenProperties({
    hub: TRUSTHUB_HUB,
    environment: analyticsEnvironment(),
    ...extra,
  });
}

export function captureTrustEvent(
  event: TrustHubEventName | string,
  properties?: Partial<TrustHubEventProperties>,
): void {
  try {
    if (!shouldEnablePosthog()) return;
    const payload = commonTrustHubProperties(properties);
    void getPosthogBrowser()
      .then((posthog) => {
        posthog?.capture(event, payload);
      })
      .catch(() => undefined);
  } catch {
    // Observability must never break product flows.
  }
}

export function captureSanitizedPageview(pathname: string, href?: string): void {
  try {
    captureTrustEvent('$pageview', {
      surface: 'app_router',
      $pathname: pathname.split('?')[0],
      $current_url: sanitizeAnalyticsUrl(href || pathname),
    } as Partial<TrustHubEventProperties>);
  } catch {
    // ignore
  }
}

export function identifyTrustHubUser(distinctId: string | null | undefined): void {
  try {
    if (!distinctId || !isOpaqueTrustHubId(distinctId)) return;
    if (!shouldEnablePosthog()) return;
    void getPosthogBrowser()
      .then((posthog) => {
        posthog?.identify(distinctId, { hub: TRUSTHUB_HUB });
      })
      .catch(() => undefined);
  } catch {
    // ignore
  }
}

export function resetTrustHubUser(): void {
  try {
    void getPosthogBrowser()
      .then((posthog) => {
        posthog?.reset();
      })
      .catch(() => undefined);
  } catch {
    // ignore
  }
}
