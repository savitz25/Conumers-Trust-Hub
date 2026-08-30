'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';

export type AskMode = 'find' | 'market' | 'compare' | 'decision';

const MODES: { id: AskMode; label: string; hint: string }[] = [
  { id: 'find', label: 'Find someone', hint: 'Search a business or identifier' },
  { id: 'market', label: 'Ask the market', hint: 'Ask about a market, not a ranking' },
  { id: 'compare', label: 'Compare places', hint: 'Places and evidence models, not scores' },
  { id: 'decision', label: 'Help with a decision', hint: 'Route a life situation' },
];

const EXAMPLES: { label: string; prompt: string; mode: AskMode; href?: string }[] = [
  {
    label: 'Roofing contractors in Broward',
    prompt: 'Show active roofing contractors in Broward County.',
    mode: 'find',
    href: 'https://www.contractortrusthub.com',
  },
  {
    label: 'FHA mortgages in Florida',
    prompt: 'Which lenders originated the most FHA mortgages in Florida?',
    mode: 'market',
    href: 'https://www.lendertrusthub.com',
  },
  {
    label: 'Palm Beach nursing homes',
    prompt: 'Show nursing homes in Palm Beach County.',
    mode: 'find',
    href: 'https://www.seniortrusthub.com/ask',
  },
  {
    label: 'Find CMS CCN 105502',
    prompt: 'Find CMS CCN 105502.',
    mode: 'find',
    href: 'https://www.seniortrusthub.com/ask',
  },
  {
    label: 'Florida RIAs $1B–$10B RAUM',
    prompt: 'Show Florida RIAs reporting between $1 billion and $10 billion RAUM.',
    mode: 'find',
    href: 'https://www.investortrusthub.com/ask',
  },
  {
    label: 'Find CRD 166089',
    prompt: 'Find CRD 166089.',
    mode: 'find',
    href: 'https://www.investortrusthub.com/ask',
  },
  {
    label: 'Florida-credentialed agencies',
    prompt: 'Show insurance agencies credentialed in Florida.',
    mode: 'find',
    href: 'https://www.insurancetrusthub.com/ask',
  },
  {
    label: 'Find NPN 10391484',
    prompt: 'Find NPN 10391484.',
    mode: 'find',
    href: 'https://www.insurancetrusthub.com/ask',
  },
  {
    label: 'Find USDOT 3244649',
    prompt: 'Find USDOT 3244649.',
    mode: 'find',
    href: 'https://www.movetrusthub.com/ask',
  },
  {
    label: 'Florida household-goods carriers',
    prompt: 'Show current interstate household-goods carriers headquartered in Florida.',
    mode: 'find',
    href: 'https://www.movetrusthub.com/ask',
  },
  {
    label: 'Buying in Palm Beach County',
    prompt: 'I am buying a home in Palm Beach County. What should I research?',
    mode: 'decision',
  },
];

export function NetworkAskInput() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AskMode>('find');

  const route = useCallback((text: string) => {
    const q = text.trim();
    if (!q) return;
    window.location.href = `/ask?q=${encodeURIComponent(q)}`;
  }, []);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      route(query);
    },
    [query, route]
  );

  const chips = useMemo(() => EXAMPLES, []);

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <form
        onSubmit={onSubmit}
        role="search"
        aria-label="Ask the TrustHub Network"
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.indigo }}
      >
        <label htmlFor="network-ask-input" className="sr-only">
          What do you want to know?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="network-ask-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to know?"
            className="min-h-12 flex-1 rounded-xl border px-4 text-base outline-none focus-visible:ring-2"
            style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
          />
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
            style={{ backgroundColor: ASK_BRAND.indigo }}
          >
            Ask
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Search a business, enter an identifier, ask about a market, compare places, or tell us
          what you are trying to do. Ask routes. Specialist hubs own the records.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Ask modes">
          {MODES.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(item.id)}
                className="inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold"
                style={{
                  borderColor: active ? ASK_BRAND.indigo : ASK_BRAND.border,
                  backgroundColor: active ? ASK_BRAND.periwinkle : ASK_BRAND.white,
                  color: ASK_BRAND.navy,
                }}
                title={item.hint}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </form>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {chips.map((ex) => (
          <li key={ex.label}>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full border bg-white px-3 text-left text-xs font-medium sm:text-sm"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              onClick={() => {
                setQuery(ex.prompt);
                setMode(ex.mode);
                route(ex.prompt);
              }}
            >
              {ex.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
