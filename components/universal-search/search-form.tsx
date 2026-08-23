'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { SEARCH_EXAMPLES } from '@/lib/search/ui/labels';
import { trackEvent } from '@/lib/analytics/track';

export function UniversalSearchForm({
  initialQuery = '',
  autoFocus = false,
  showExamples = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  showExamples?: boolean;
}) {
  const [q, setQ] = useState(initialQuery);
  const [pending, setPending] = useState(false);

  return (
    <div data-universal-search="form">
      <form
        action="/search"
        method="get"
        role="search"
        aria-label="Universal Search"
        onSubmit={() => {
          if (pending) return;
          setPending(true);
          trackEvent('search_submitted', { q_len: q.trim().length });
        }}
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.card }}
      >
        <label htmlFor="universal-search-q" className="sr-only">
          Search movers, lenders, insurance, or contractors
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
              style={{ color: ASK_BRAND.indigo }}
              aria-hidden
            />
            <input
              id="universal-search-q"
              name="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value.slice(0, 300))}
              autoFocus={autoFocus}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search movers, lenders, insurance, contractors…"
              className="min-h-12 w-full rounded-xl border bg-white py-3 pl-12 pr-4 text-base outline-none focus-visible:ring-2"
              style={{
                borderColor: ASK_BRAND.border,
                color: ASK_BRAND.navy,
                ['--tw-ring-color' as string]: ASK_BRAND.indigo,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={pending || !q.trim()}
            className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition-opacity disabled:opacity-60 sm:min-w-[7.5rem]"
            style={{ backgroundColor: ASK_BRAND.indigo }}
          >
            {pending ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      {showExamples ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Example searches">
          {SEARCH_EXAMPLES.map((ex) => (
            <li key={ex.q}>
              <a
                href={`/search?q=${encodeURIComponent(ex.q)}`}
                className="inline-flex min-h-9 items-center rounded-full border bg-white px-3 text-xs font-semibold no-underline"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              >
                {ex.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
