'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';

const EXAMPLES = [
  ['USDOT 3244649', 'Find USDOT 3244649.'],
  ['CRD 166089', 'Find CRD 166089.'],
  ['CMS CCN 105502', 'Find CMS CCN 105502.'],
  ['Roofing contractors in Broward', 'Show active roofing contractors in Broward County.'],
  ['What does TrustHub know about Florida?', 'What does TrustHub know about Florida?'],
] as const;

export function NetworkAskInput() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const route = useCallback((text: string) => {
    const normalized = text.trim();
    if (normalized) router.push(`/ask?q=${encodeURIComponent(normalized)}`);
  }, [router]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    route(query);
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <form onSubmit={onSubmit} role="search" aria-label="Search the Trust Hub Network" className="rounded-2xl border bg-white p-3 sm:p-4" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.indigo }}>
        <label htmlFor="network-ask-input" className="mb-2 block text-left text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Search the Trust Hub Network</label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input id="network-ask-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Company, identifier, market, place, or research question" className="min-h-12 flex-1 rounded-xl border px-4 text-base outline-none focus-visible:ring-2" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }} />
          <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2" style={{ backgroundColor: ASK_BRAND.indigo }}>
            Search <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-left text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>Ask routes the question. Each specialist Trust Hub owns its identities, evidence, and source meaning.</p>
      </form>
      <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Example searches">
        {EXAMPLES.map(([label, prompt]) => <li key={label}><button type="button" onClick={() => route(prompt)} className="inline-flex min-h-11 items-center rounded-full border bg-white px-3 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 sm:text-sm" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}>{label}</button></li>)}
      </ul>
    </div>
  );
}
