import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { INDEPENDENCE_LINE } from '@/lib/search/ui/labels';
import type { UniversalSearchModel } from '@/lib/search/ui/run-search';
import { SearchResultCard } from './result-card';
import { SearchPageAnalytics, ViewMoreTracker } from './analytics-hooks';
import { UniversalSearchForm } from './search-form';

export function UniversalSearchResults({ model }: { model: UniversalSearchModel }) {
  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <SearchPageAnalytics
        status={model.status}
        hub={model.hub}
        total={model.total}
        shown={model.topMatches.length}
      />
      <UniversalSearchForm initialQuery={model.q} />

      <div className="mt-8 min-w-0" aria-live="polite" aria-atomic="true">
        {model.status === 'error' ? (
          <StatusBlock title="Search unavailable" body={model.errorSafe || 'Please try again.'} />
        ) : null}

        {model.status === 'needs_clarification' ? (
          <section>
            <h2 className="break-words text-xl font-semibold [overflow-wrap:anywhere]" style={{ color: ASK_BRAND.navy }}>
              {model.clarification?.prompt || 'We need a bit more detail'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Ask does not guess between similar company types or use your device location.
            </p>
            {model.clarification?.choices?.length ? (
              <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {model.clarification.choices.map((c) => (
                  <li key={c.href} className="min-w-0 max-w-full">
                    <a
                      href={c.href}
                      className="inline-flex min-h-11 max-w-full items-center rounded-xl border bg-white px-4 py-2 text-sm font-semibold no-underline outline-none focus-visible:ring-2"
                      style={{
                        borderColor: ASK_BRAND.border,
                        color: ASK_BRAND.navy,
                        ['--tw-ring-color' as string]: ASK_BRAND.indigo,
                      }}
                    >
                      <span className="break-words [overflow-wrap:anywhere]">{c.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {model.status === 'unsupported' ? (
          <StatusBlock
            title="This search isn’t available yet"
            body={model.message || 'We did not invent a different category or Hub.'}
          />
        ) : null}

        {model.status === 'empty' ? (
          <section className="min-w-0">
            <h2 className="break-words text-xl font-semibold [overflow-wrap:anywhere]" style={{ color: ASK_BRAND.navy }}>
              No verified matches
            </h2>
            <p className="mt-2 break-words text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: ASK_BRAND.ink }}>
              {model.message} That does not mean no companies exist — only that this safe index
              returned zero.
            </p>
            {model.viewMore ? (
              <p className="mt-4">
                <a
                  href={model.viewMore.href}
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  Continue on {model.hubLabel || 'the specialist Hub'}
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {model.status === 'ok' ? (
          <section aria-labelledby="top-matches-heading">
            {model.hubLabel ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
                Searching {model.hubLabel}
              </p>
            ) : null}
            <h2
              id="top-matches-heading"
              className="mt-1 text-2xl font-semibold tracking-tight"
              style={{ color: ASK_BRAND.navy }}
            >
              Top Matches
            </h2>
            <p className="mt-1 text-sm" style={{ color: ASK_BRAND.ink }}>
              {model.topMatches.length} of {model.total} verified {model.total === 1 ? 'match' : 'matches'}
            </p>
            <ol className="mt-5 space-y-4">
              {model.topMatches.map((card, i) => (
                <li key={card.id}>
                  <SearchResultCard card={card} index={i} />
                </li>
              ))}
            </ol>
            {model.viewMore ? (
              <p className="mt-6">
                <ViewMoreTracker hub={model.hub}>
                  <a
                    href={model.viewMore.href}
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold no-underline outline-none focus-visible:ring-2 sm:w-auto"
                    style={{
                      borderColor: ASK_BRAND.indigo,
                      color: ASK_BRAND.indigo,
                      ['--tw-ring-color' as string]: ASK_BRAND.indigo,
                    }}
                  >
                    View More Results
                  </a>
                </ViewMoreTracker>
              </p>
            ) : null}
            <p className="mt-6 text-xs leading-relaxed" style={{ color: '#64748B' }}>
              {INDEPENDENCE_LINE} Ask finds providers; specialist Hubs hold the research.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatusBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="min-w-0">
      <h2 className="break-words text-xl font-semibold [overflow-wrap:anywhere]" style={{ color: ASK_BRAND.navy }}>
        {title}
      </h2>
      <p className="mt-2 break-words text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: ASK_BRAND.ink }}>
        {body}
      </p>
    </section>
  );
}
