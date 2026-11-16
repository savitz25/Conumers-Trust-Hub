'use client';

import type { PostHog } from 'posthog-js';
import { analyticsEnvironment, posthogHost, posthogProjectToken, shouldEnablePosthog } from './environment';
import { createPosthogClientGate } from './posthog-gate';
import { prepareOutboundCapture, sanitizeCapturedNetworkRequest } from './privacy';
import { installAnalyticsTransportGuard } from './sdk-guard';
import { TRUSTHUB_EVENTS, TRUSTHUB_HUB } from './trusthub-events';

const APPROVED_POSTHOG_EVENTS = new Set<string>(Object.values(TRUSTHUB_EVENTS));

function sanitizeEvent<T extends { event?: string; properties?: Record<string, unknown> } | null>(event: T): T | null {
  return prepareOutboundCapture(event, APPROVED_POSTHOG_EVENTS);
}

async function loadPosthog(): Promise<PostHog | null> {
  if (!shouldEnablePosthog()) return null;
  installAnalyticsTransportGuard();
  const { loadPosthogSdk } = await import('./posthog-sdk');
  return loadPosthogSdk(posthogProjectToken(), {
    api_host: posthogHost(),
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    respect_dnt: true,
    persistence: 'localStorage+cookie',
    disable_session_recording: true,
    enable_heatmaps: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    autocapture: false,
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

if (typeof window !== 'undefined') installAnalyticsTransportGuard();
