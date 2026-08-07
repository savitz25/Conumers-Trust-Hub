'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  ASK_HERO_CONCIERGE_PLACEHOLDER,
  ASK_HERO_PRIMARY_CTA,
} from '@/lib/design/ask-design-system';
import { matchSituationFromQuery } from '@/lib/situations';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** When true, primary submit uses full-width stacked layout (mobile hero) */
  stacked?: boolean;
};

/**
 * Hero Concierge entry — no PII, no accounts.
 * Matches keywords to situation routes or scrolls to the Ask grid.
 */
export function ConciergeEntry({ className, stacked = false }: Props) {
  const [query, setQuery] = useState('');

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      const match = q ? matchSituationFromQuery(q) : null;

      if (match) {
        const el = document.getElementById(`situation-${match.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#4F46E5]', 'ring-offset-2');
          window.setTimeout(() => {
            el.classList.remove('ring-2', 'ring-[#4F46E5]', 'ring-offset-2');
          }, 2200);
          return;
        }
      }

      const ask = document.getElementById('ask');
      ask?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [query]
  );

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-[0_8px_28px_-10px_rgb(10_37_64_/_0.14)]',
        stacked ? 'flex flex-col gap-2' : 'flex flex-col gap-2 sm:flex-row sm:items-stretch',
        className
      )}
      role="search"
      aria-label="Ask Concierge"
    >
      <label htmlFor="ask-concierge-input" className="sr-only">
        What are you preparing for?
      </label>
      <div className="relative min-w-0 flex-1">
        <Sparkles
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4F46E5]"
          aria-hidden
        />
        <input
          id="ask-concierge-input"
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="go"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ASK_HERO_CONCIERGE_PLACEHOLDER}
          className={cn(
            'h-12 w-full rounded-xl border-0 bg-[#F8FAFC] pl-10 pr-3 text-sm font-medium text-[#1E293B]',
            'placeholder:text-[#64748B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/35',
            'sm:text-[15px]'
          )}
        />
      </div>
      <button
        type="submit"
        className={cn(
          'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-colors',
          'bg-[#4F46E5] hover:bg-[#6B21A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2',
          stacked ? 'w-full' : 'w-full sm:w-auto'
        )}
      >
        {ASK_HERO_PRIMARY_CTA.label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
