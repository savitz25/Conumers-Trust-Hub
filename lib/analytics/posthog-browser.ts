'use client';

import type { PostHog } from 'posthog-js';
import { analyticsEnvironment, posthogHost, posthogProjectToken, shouldEnablePosthog } from './environment';
import { createPosthogClientGate } from './posthog-gate';
import { sanitizeCapturedNetworkRequest, sanitizeCaptureResult } from './privacy';
import { TRUSTHUB_HUB } from './trusthub-events';

function sanitizeEvent<T extends { event?: string; properties?: Record<string, unknown> } | null>(event: T): T {
  return sanitizeCaptureResult(event);
}

async function loadPosthog(): Promise<PostHog | null> {
  const posthog = (await import('posthog-js')).default;
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
      maskCapturedNetworkRequestFn: (request) => sanitizeCapturedNetworkRequest(request),
    },
    loaded: (instance) => {
      instance.register({
        hub: TRUSTHUB_HUB,
        environment: analyticsEnvironment(),
      });
    },
  });
  return posthog;
}

const gate = createPosthogClientGate<PostHog>(loadPosthog);

export async function getPosthogBrowser(): Promise<PostHog | null> {
  if (typeof window === 'undefined') return null;
  if (!shouldEnablePosthog()) return null;
  return gate.get();
}

export function resetPosthogBrowserForTests(): void {
  gate.reset();
}
