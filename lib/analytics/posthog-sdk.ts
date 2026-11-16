'use client';

import type { PostHog } from 'posthog-js';

type PostHogInitConfig = NonNullable<Parameters<PostHog['init']>[1]>;

/**
 * The only module allowed to evaluate posthog-js.
 * Callers must dynamic-import this file after shouldEnablePosthog() is true.
 * A closed gate must not evaluate this module, so the SDK never initializes,
 * records, autocaptures, surveys, or writes a persistence identifier.
 */
export const POSTHOG_SDK_MODULE_MARKER = 'trusthub-posthog-sdk-isolated';

export async function loadPosthogSdk(token: string, options: PostHogInitConfig): Promise<PostHog> {
  void POSTHOG_SDK_MODULE_MARKER;
  const posthog = (await import('posthog-js')).default;
  posthog.init(token, options);
  return posthog;
}
