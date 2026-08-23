import type { Metadata } from 'next';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { runUniversalSearch } from '@/lib/search/ui/run-search';
import { UniversalSearchResults } from '@/components/universal-search/search-results';
import { UniversalSearchForm } from '@/components/universal-search/search-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Universal Search',
  description:
    'Find movers, lenders, insurance agencies, contractors, nursing facilities, and investment advisers across the Trust Hub network.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Universal Search · Ask Trust Hub',
    description: 'Find verified providers across the Trust Hub network.',
  },
};

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] || '';
  return v || '';
}

export default async function UniversalSearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = first(sp.q);
  const model = runUniversalSearch(q);

  return (
    <div
      className="min-w-0 overflow-x-clip border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
    >
      <div className="container-page py-10 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          Universal Search
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
          Find. Then research on the specialist Hub.
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Ask discovers verified providers. Specialist Trust Hubs remain the research authority —
          including Move, Lender, Insurance, Contractor, Senior, and Investor.
        </p>

        <div className="mt-8">
          {model.status === 'idle' ? <UniversalSearchForm autoFocus showExamples /> : <UniversalSearchResults model={model} />}
        </div>
      </div>
    </div>
  );
}
