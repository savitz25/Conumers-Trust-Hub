'use client';

import type { ReactNode } from 'react';
import { captureProjectItemAdded } from '@/components/analytics/ask-instrumentation';

/**
 * ATH-OBS-002D: for server actions that finish WITHOUT a redirect. The success event is captured
 * only after the awaited action resolves. A failing action redirects (Next throws NEXT_REDIRECT
 * through the await), so the line after it never runs and no success is recorded.
 */
export function ProjectAddForm({ action, surface, children, className }: {
  action: (formData: FormData) => Promise<void>;
  surface: 'my_saved' | 'my_project_detail';
  children: ReactNode;
  className?: string;
}) {
  async function run(formData: FormData) {
    await action(formData);
    try { captureProjectItemAdded(surface); } catch { /* analytics must never break the action */ }
  }
  return <form action={run} className={className}>{children}</form>;
}
