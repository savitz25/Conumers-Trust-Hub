'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AiConciergeDisclosure } from '@/components/ask-chat/ai-disclosure';
import { useAskChat } from '@/components/ask-chat/ask-chat-context';
import {
  ASK_BRAND,
  ASK_CONCIERGE_EXAMPLES,
  ASK_HERO_CONCIERGE_MICRO,
  ASK_HERO_CONCIERGE_PLACEHOLDER,
  ASK_HERO_PRIMARY_CTA,
  ASK_SHADOW,
} from '@/lib/design/ask-design-system';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Larger product treatment for homepage hero */
  dominant?: boolean;
};

/**
 * Concierge entry — primary product interaction on Ask.
 * Opens AI chat with optional initial prompt from input or example chips.
 */
export function ConciergeEntry({ className, dominant = false }: Props) {
  const [query, setQuery] = useState('');
  const { openChat } = useAskChat();

  const launch = useCallback(
    (text?: string) => {
      const q = (text ?? query).trim();
      openChat(q ? { initialPrompt: q } : undefined);
    },
    [openChat, query]
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      launch();
    },
    [launch]
  );

  return (
    <div className={cn('space-y-3', className)} data-hub="ask" id={dominant ? 'ask' : undefined}>
      <form
        onSubmit={onSubmit}
        className={cn(
          'rounded-2xl border bg-white',
          dominant ? 'p-3 sm:p-4 shadow-lg' : 'p-2'
        )}
        style={{
          borderColor: ASK_BRAND.border,
          boxShadow: dominant ? ASK_SHADOW.indigo : ASK_SHADOW.card,
        }}
        role="search"
        aria-label="Ask Concierge"
      >
        <label htmlFor="ask-concierge-input" className="sr-only">
          What are you trying to figure out?
        </label>
        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-stretch',
            dominant && 'sm:gap-3'
          )}
        >
          <div className="relative min-w-0 flex-1">
            <Sparkles
              className={cn(
                'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2',
                dominant ? 'h-5 w-5' : 'h-4 w-4'
              )}
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
                'w-full rounded-xl border-0 font-medium',
                dominant
                  ? 'h-14 pl-12 pr-4 text-base sm:text-lg'
                  : 'h-12 pl-10 pr-3 text-sm sm:text-[15px]',
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
              'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              dominant ? 'h-14 min-h-14 w-full text-base sm:w-auto sm:min-w-[12rem]' : 'h-12 min-h-12 w-full sm:w-auto sm:min-w-[11rem]'
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
        </div>
      </form>

      <ul
        className="flex flex-wrap gap-2"
        aria-label="Suggested situations"
      >
        {ASK_CONCIERGE_EXAMPLES.map((ex) => (
          <li key={ex.label}>
            <button
              type="button"
              onClick={() => {
                setQuery(ex.prompt);
                launch(ex.prompt);
              }}
              className="inline-flex min-h-10 items-center rounded-full border bg-white px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm"
              style={{
                borderColor: ASK_BRAND.border,
                color: ASK_BRAND.navy,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = ASK_BRAND.indigo;
                e.currentTarget.style.backgroundColor = ASK_BRAND.periwinkle;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = ASK_BRAND.border;
                e.currentTarget.style.backgroundColor = ASK_BRAND.white;
              }}
            >
              {ex.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="px-0.5 text-xs leading-relaxed sm:text-sm" style={{ color: ASK_BRAND.ink }}>
        {ASK_HERO_CONCIERGE_MICRO}
      </p>
      <AiConciergeDisclosure className="px-0.5" />
    </div>
  );
}
