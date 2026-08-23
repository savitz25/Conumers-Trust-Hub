'use client';

import { useEffect, type ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics/track';

export function SearchPageAnalytics({
  status,
  hub,
  total,
  shown,
}: {
  status: string;
  hub?: string;
  total: number;
  shown: number;
}) {
  useEffect(() => {
    trackEvent('search_resolved', { status, hub: hub || '', result_count: total });
    if (status === 'ok') trackEvent('top_matches_rendered', { hub: hub || '', shown, result_count: total });
    if (status === 'empty') trackEvent('zero_results', { hub: hub || '' });
    if (status === 'unsupported') trackEvent('unsupported_search', { hub: hub || '' });
    if (status === 'needs_clarification') trackEvent('clarification_shown', { hub: hub || '' });
  }, [status, hub, total, shown]);
  return null;
}

export function ResultClickTracker({
  children,
  hub,
  index,
}: {
  children: ReactNode;
  hub: string;
  index: number;
  href?: string;
}) {
  return (
    <span onClick={() => trackEvent('result_clicked', { hub, index, handoff_type: 'entity' })}>
      {children}
    </span>
  );
}

export function ViewMoreTracker({
  children,
  hub,
}: {
  children: ReactNode;
  hub?: string;
}) {
  return (
    <span onClick={() => trackEvent('view_more_clicked', { hub: hub || '', handoff_type: 'view_more' })}>
      {children}
    </span>
  );
}
