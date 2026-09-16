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
    if (lastPath.current === path) return;
    lastPath.current = path;
    void getPosthogBrowser().then((posthog) => {
      if (!posthog) return;
      captureSanitizedPageview(path, window.location.origin + path);
    });
  }, [pathname, searchParams]);

  return null;
}

function PosthogIdentity() {
  useEffect(() => {
    if (!shouldEnablePosthog()) return;
    let cancelled = false;
    void fetch('/api/analytics/identity', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { distinctId: null }))
      .then((body: { distinctId?: string | null }) => {
        if (cancelled) return;
        if (body.distinctId) identifyTrustHubUser(body.distinctId);
        else resetTrustHubUser();
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
