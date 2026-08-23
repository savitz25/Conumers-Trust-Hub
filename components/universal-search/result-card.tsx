import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { SearchCardModel } from '@/lib/search/ui/run-search';
import { ResultClickTracker } from './analytics-hooks';

export function SearchResultCard({ card, index }: { card: SearchCardModel; index: number }) {
  const nameId = `result-${card.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-name`;

  return (
    <article
      className="min-w-0 overflow-hidden rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
      data-search-card
      data-hub={card.hubId}
      aria-labelledby={nameId}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
        {card.hubLabel}
      </p>
      <h3
        id={nameId}
        className="mt-1 min-w-0 break-words text-lg font-semibold tracking-tight [overflow-wrap:anywhere]"
        style={{ color: ASK_BRAND.navy }}
      >
        <a
          href={card.profileUrl}
          rel="noopener noreferrer"
          className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
          style={{ ['--tw-ring-color' as string]: ASK_BRAND.indigo }}
        >
          {card.displayName}
        </a>
      </h3>
      <p
        className="mt-1 min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]"
        style={{ color: ASK_BRAND.ink }}
      >
        {card.entityLabel}
        {card.placeLine ? <span className="font-normal opacity-80"> · {card.placeLine}</span> : null}
      </p>
      {card.reasonLine ? (
        <p
          className="mt-2 min-w-0 break-words text-sm leading-relaxed [overflow-wrap:anywhere]"
          style={{ color: ASK_BRAND.ink }}
        >
          {card.reasonLine}
        </p>
      ) : null}
      {card.regulatory ? (
        <p
          className="mt-1 min-w-0 break-words text-xs leading-relaxed [overflow-wrap:anywhere]"
          style={{ color: '#64748B' }}
        >
          {card.regulatory}
        </p>
      ) : null}
      <p className="mt-4 min-w-0">
        <ResultClickTracker hub={card.hubId} index={index} href={card.profileUrl}>
          <a
            href={card.profileUrl}
            rel="noopener noreferrer"
            className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl px-4 py-2 text-center text-sm font-semibold text-white no-underline outline-none focus-visible:ring-2"
            style={{
              backgroundColor: ASK_BRAND.indigo,
              ['--tw-ring-color' as string]: ASK_BRAND.indigo,
            }}
          >
            <span className="break-words [overflow-wrap:anywhere]">{card.researchCta}</span>
          </a>
        </ResultClickTracker>
      </p>
    </article>
  );
}
