'use client';

import { AUTOMATIC_IDENTITY_COLLECTION, AUTOMATIC_PAGEVIEW_CAPTURE, analyticsEnvironment, shouldEnablePosthog } from './environment';
import { getPosthogBrowser } from './posthog-browser';
import { isOpaqueTrustHubId, sanitizeAnalyticsUrl, stripForbiddenProperties } from './privacy';
import { TRUSTHUB_EVENTS, TRUSTHUB_HUB, type TrustHubEventName, type TrustHubEventProperties } from './trusthub-events';

const APPROVED_POSTHOG_EVENTS = new Set<string>(Object.values(TRUSTHUB_EVENTS));

export function commonTrustHubProperties(
  extra?: Partial<TrustHubEventProperties>,
): Record<string, string | number | boolean> {
  return stripForbiddenProperties({
    hub: TRUSTHUB_HUB,
    environment: analyticsEnvironment(),
    ...extra,
  });
}

export type TrustHubCaptureOptions = {
  /** Use before GET navigation / full page unload. Does not sleep. */
  sendBeforeUnload?: boolean;
};

let lastPageviewPath = '';

export function captureTrustEvent(
  event: TrustHubEventName | string,
  properties?: Partial<TrustHubEventProperties>,
  options?: TrustHubCaptureOptions,
): void {
  try {
    if (!shouldEnablePosthog()) return;
    if (!APPROVED_POSTHOG_EVENTS.has(event)) return;
    const payload = commonTrustHubProperties(properties);
    void getPosthogBrowser()
      .then((posthog) => {
        if (!posthog) return;
        if (options?.sendBeforeUnload) {
          posthog.capture(event, payload, { send_instantly: true, transport: 'sendBeacon' });
          return;
        }
        posthog.capture(event, payload);
      })
      .catch(() => undefined);
  } catch {
    // Observability must never break product flows.
  }
}

export function captureSanitizedPageview(pathname: string, href?: string): void {
  try {
    if (!AUTOMATIC_PAGEVIEW_CAPTURE) return;
    const path = pathname.split('?')[0] || '/';
    if (lastPageviewPath === path) return;
    lastPageviewPath = path;
    captureTrustEvent('$pageview', {
      surface: 'app_router',
      $pathname: path,
      $current_url: sanitizeAnalyticsUrl(href || pathname),
    } as Partial<TrustHubEventProperties>);
  } catch {
    // ignore
  }
}

export function resetPageviewDedupeForTests(): void {
  lastPageviewPath = '';
}

export function identifyTrustHubUser(distinctId: string | null | undefined): void {
  try {
    if (!AUTOMATIC_IDENTITY_COLLECTION) return;
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
