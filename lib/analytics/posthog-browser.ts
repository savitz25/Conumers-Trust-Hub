'use client';

import type { PostHog } from 'posthog-js';
import { analyticsEnvironment, posthogHost, posthogProjectToken, shouldEnablePosthog } from './environment';
import { sanitizePageviewProperties } from './privacy';
import { TRUSTHUB_HUB } from './trusthub-events';

let client: PostHog | null = null;
let initializing = false;

function sanitizeEvent<T extends { properties?: Record<string, unknown> } | null>(event: T): T {
  if (!event?.properties) return event;
  sanitizePageviewProperties(event.properties);
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
