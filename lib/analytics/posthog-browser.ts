'use client';

import type { PostHog } from 'posthog-js';
import { analyticsEnvironment, posthogHost, posthogProjectToken, shouldEnablePosthog } from './environment';
import { FORBIDDEN_EVENT_KEYS, sanitizeAnalyticsUrl } from './privacy';
import { TRUSTHUB_HUB } from './trusthub-events';

let client: PostHog | null = null;
let initializing = false;

function sanitizeEvent<T extends { properties?: Record<string, unknown> } | null>(event: T): T {
  if (!event?.properties) return event;
  const properties = event.properties;
  if (typeof properties.$current_url === 'string') {
    properties.$current_url = sanitizeAnalyticsUrl(properties.$current_url);
  }
  if (typeof properties.$pathname === 'string') {
    properties.$pathname = String(properties.$pathname).split('?')[0];
  }
  if (typeof properties.$referrer === 'string') {
    properties.$referrer = sanitizeAnalyticsUrl(properties.$referrer);
  }
  for (const key of Object.keys(properties)) {
    if (FORBIDDEN_EVENT_KEYS.includes(key.toLowerCase() as (typeof FORBIDDEN_EVENT_KEYS)[number])) {
      delete properties[key];
    }
  }
  return event;
}

export async function getPosthogBrowser(): Promise<PostHog | null> {
  if (typeof window === 'undefined') return null;
  if (!shouldEnablePosthog()) return null;
  if (client) return client;
  if (initializing) return client;
  initializing = true;
  try {
    const posthog = (await import('posthog-js')).default;
    if (client) return client;
    posthog.init(posthogProjectToken(), {
      api_host: posthogHost(),
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      autocapture: true,
      before_send: (event) => sanitizeEvent(event),
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: true,
        },
        maskTextSelector: 'input, textarea, [contenteditable], [data-ph-mask], .myth-form, .myth-auth-card',
      },
      loaded: (instance) => {
        instance.register({
          hub: TRUSTHUB_HUB,
          environment: analyticsEnvironment(),
        });
      },
    });
    client = posthog;
    return client;
  } catch {
    client = null;
    return null;
  } finally {
    initializing = false;
  }
}

export function resetPosthogBrowserForTests(): void {
  client = null;
  initializing = false;
}
