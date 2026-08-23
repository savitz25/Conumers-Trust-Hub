'use client';

import { useEffect, useId, useState } from 'react';
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
  const reactId = useId();
  const inputId = `universal-search-q-${reactId.replace(/:/g, '')}`;
  const [q, setQ] = useState(initialQuery);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const onPageShow = () => setPending(false);
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return (
    <div data-universal-search="form" className="min-w-0">
      <form
        action="/search"
        method="get"
        role="search"
        aria-label="Universal Search"
        aria-busy={pending}
        onSubmit={(event) => {
          if (pending || !q.trim()) {
            event.preventDefault();
            return;
          }
          setPending(true);
          trackEvent('search_submitted', { q_len: q.trim().length });
        }}
        className="min-w-0 rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.card }}
      >
        <label htmlFor={inputId} className="sr-only">
          Search movers, lenders, insurance, or contractors
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
              style={{ color: ASK_BRAND.indigo }}
              aria-hidden
            />
            <input
              id={inputId}
              data-universal-search-input=""
              name="q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value.slice(0, 300))}
              maxLength={300}
              autoFocus={autoFocus}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Search movers, lenders, insurance, contractors…"
              className="min-h-12 w-full min-w-0 rounded-xl border bg-white py-3 pl-12 pr-4 text-base outline-none focus-visible:ring-2"
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
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white outline-none transition-opacity focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[7.5rem]"
            style={{
              backgroundColor: ASK_BRAND.indigo,
              ['--tw-ring-color' as string]: ASK_BRAND.indigo,
            }}
          >
            {pending ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {pending ? 'Searching licensed providers' : ''}
        </p>
      </form>
      {showExamples ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Example searches">
          {SEARCH_EXAMPLES.map((ex) => (
            <li key={ex.q} className="min-w-0 max-w-full">
              <a
                href={`/search?q=${encodeURIComponent(ex.q)}`}
                className="inline-flex min-h-11 max-w-full items-center rounded-full border bg-white px-3 py-1.5 text-left text-xs font-semibold no-underline outline-none focus-visible:ring-2"
                style={{
                  borderColor: ASK_BRAND.border,
                  color: ASK_BRAND.navy,
                  ['--tw-ring-color' as string]: ASK_BRAND.indigo,
                }}
              >
                <span className="break-words [overflow-wrap:anywhere]">{ex.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
