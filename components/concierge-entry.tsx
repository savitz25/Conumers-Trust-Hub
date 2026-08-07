'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  ASK_BRAND,
  ASK_HERO_CONCIERGE_PLACEHOLDER,
  ASK_HERO_PRIMARY_CTA,
  ASK_SHADOW,
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
      data-hub="ask"
      onSubmit={onSubmit}
      className={cn(
        'rounded-2xl border bg-white p-2',
        stacked ? 'flex flex-col gap-2' : 'flex flex-col gap-2 sm:flex-row sm:items-stretch',
        className
      )}
      style={{
        borderColor: ASK_BRAND.border,
        boxShadow: ASK_SHADOW.card,
      }}
      role="search"
      aria-label="Ask Concierge"
    >
      <label htmlFor="ask-concierge-input" className="sr-only">
        What are you preparing for?
      </label>
      <div className="relative min-w-0 flex-1">
        <Sparkles
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: ASK_BRAND.indigo }}
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
            'h-12 w-full rounded-xl border-0 pl-10 pr-3 text-sm font-medium sm:text-[15px]',
            'focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40'
          )}
          style={{
            backgroundColor: ASK_BRAND.canvas,
            color: ASK_BRAND.ink,
          }}
        />
      </div>
      <button
        type="submit"
        className={cn(
          'inline-flex h-12 min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          stacked ? 'w-full' : 'w-full sm:w-auto sm:min-w-[11rem]'
        )}
        style={{
          backgroundColor: ASK_BRAND.indigo,
          boxShadow: ASK_SHADOW.indigo,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = ASK_BRAND.purple;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = ASK_BRAND.indigo;
        }}
      >
        {ASK_HERO_PRIMARY_CTA.label}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
