import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { SearchCardModel } from '@/lib/search/ui/run-search';
import { ResultClickTracker } from './analytics-hooks';

export function SearchResultCard({ card, index }: { card: SearchCardModel; index: number }) {
  return (
    <article
      className="rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
      data-search-card
      data-hub={card.hubId}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
        {card.hubLabel}
      </p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
        <a
          href={card.profileUrl}
          rel="noopener noreferrer"
          className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: ASK_BRAND.indigo }}
        >
          {card.displayName}
        </a>
      </h3>
      <p className="mt-1 text-sm font-medium" style={{ color: ASK_BRAND.ink }}>
        {card.entityLabel}
        {card.placeLine ? <span className="font-normal opacity-80"> · {card.placeLine}</span> : null}
      </p>
      {card.reasonLine ? (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {card.reasonLine}
        </p>
      ) : null}
      {card.regulatory ? (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: '#64748B' }}>
          {card.regulatory}
        </p>
      ) : null}
      <p className="mt-4">
        <ResultClickTracker hub={card.hubId} index={index} href={card.profileUrl}>
          <a
            href={card.profileUrl}
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-white no-underline"
            style={{ backgroundColor: ASK_BRAND.indigo }}
          >
            {card.researchCta}
          </a>
        </ResultClickTracker>
      </p>
    </article>
  );
}
