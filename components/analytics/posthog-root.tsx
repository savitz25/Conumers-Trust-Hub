'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { captureSanitizedPageview, identifyTrustHubUser, resetTrustHubUser } from '@/lib/analytics/trusthub';
import { getPosthogBrowser } from '@/lib/analytics/posthog-browser';
import { shouldEnablePosthog } from '@/lib/analytics/environment';

function PosthogPageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string>('');

  useEffect(() => {
    if (!shouldEnablePosthog()) return;
    const path = pathname || '/';
    let cancelled = false;
    void getPosthogBrowser()
      .then((posthog) => {
        if (cancelled || !posthog) return;
        if (lastPath.current === path) return;
        lastPath.current = path;
        captureSanitizedPageview(path, `${window.location.origin}${path}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams]);

  return null;
}

function PosthogIdentity() {
  const identified = useRef(false);
  useEffect(() => {
    if (!shouldEnablePosthog()) return;
    let cancelled = false;
    void fetch('/api/analytics/identity', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { distinctId: null }))
      .then((body: { distinctId?: string | null }) => {
        if (cancelled) return;
        if (body.distinctId) {
          identified.current = true;
          identifyTrustHubUser(body.distinctId);
          return;
        }
        // Anonymous visitors stay anonymous. Do not reset() on every page load —
        // that would drop queued telemetry. Reset only after a prior identify.
        if (identified.current) {
          identified.current = false;
          resetTrustHubUser();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

export function PosthogRoot() {
  useEffect(() => {
    void getPosthogBrowser().catch(() => undefined);
  }, []);
  return (
    <>
      <PosthogPageviews />
      <PosthogIdentity />
    </>
  );
}
