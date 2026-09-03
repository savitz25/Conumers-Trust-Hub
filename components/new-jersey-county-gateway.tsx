import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import type { SpecialistHubId } from '@/lib/network/registry';
import {
  HUB_CARD_ORDER,
  HUB_CARD_TITLES,
  NJ_COUNTY_CARD_FACTS,
  dedicatedCountyPage,
  listNjPilotCounties,
  njCountyAskPath,
  njCountySpecialistUrl,
  seniorCountyGatePassed,
  specialistCtaLabel,
  type NjCountyRecord,
  type NjPilotCountySlug,
} from '@/lib/network/nj-counties';

function AskLink({ q, children }: { q: string; children: string }) {
  return (
    <Link
      href={`/ask?q=${encodeURIComponent(q)}`}
      className="inline-flex min-h-11 w-full items-center whitespace-normal break-words rounded-xl border px-4 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
      style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
    >
      {children}
    </Link>
  );
}

export function NewJerseyCountyGateway({ county }: { county: NjCountyRecord }) {
  const slug = county.county_slug as NjPilotCountySlug;
  const facts = NJ_COUNTY_CARD_FACTS[slug];
  const seniorLive = seniorCountyGatePassed();
  const siblings = listNjPilotCounties().filter((c) => c.county_slug !== slug);

  return (
    <main className="container-page overflow-x-clip py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm" style={{ color: ASK_BRAND.ink }}>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
          style={{ color: ASK_BRAND.indigo }}
        >
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link
          href="/new-jersey"
          className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2"
          style={{ color: ASK_BRAND.indigo }}
        >
          New Jersey
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{county.county} County</span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
        Trust Hub Network · {county.county} County
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: ASK_BRAND.navy }}>
        What can the Trust Hub Network research in {county.county} County?
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        AskTrustHub is a thin county gateway. Detailed evidence lives on specialist hubs. This is research
        availability, not a county score, ranking, or Trust Score.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Four counties currently have deeper local research coverage. Missing official evidence is unknown, not
        zero.
      </p>

      <section className="mt-10" aria-labelledby="hub-grid">
        <h2 id="hub-grid" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Six-hub research in {county.county} County
        </h2>
        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {HUB_CARD_ORDER.map((hubId) => {
            const dedicated = dedicatedCountyPage(hubId, slug);
            const href = njCountySpecialistUrl(hubId, slug);
            const body = facts[hubId];
            const priority = hubId === 'contractor';
            return (
              <li
                key={hubId}
                className="flex min-w-0 flex-col rounded-2xl border p-5"
                style={{
                  borderColor: priority ? ASK_BRAND.indigo : ASK_BRAND.border,
                  boxShadow: ASK_SHADOW.soft,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                    {HUB_CARD_TITLES[hubId as SpecialistHubId]}
                  </h3>
                  <span className="text-[11px] font-semibold uppercase" style={{ color: ASK_BRAND.indigo }}>
                    {dedicated ? 'County page' : 'State research'}
                  </span>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
                  {body.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {hubId === 'contractor' ? (
                  <p className="mt-3 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                    ContractorTrustHub may surface public business contact information from official
                    vendor/public sources while preserving source identity. Ask does not duplicate vendor
                    rows.
                  </p>
                ) : null}
                {hubId === 'senior' && !seniorLive ? (
                  <p className="mt-3 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                    Direct Senior county pages are not published yet, so this card does not claim they are live.
                  </p>
                ) : null}
                <a
                  href={href}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2"
                  style={{ backgroundColor: ASK_BRAND.navy }}
                >
                  {specialistCtaLabel(hubId, dedicated, county.county)}
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="sources">
        <h2 id="sources" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Local source panel
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Already-audited county research access. This is not a giant source catalog and not a scrape of land
          records.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {county.local_source_families.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="starters">
        <h2 id="starters" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          Questions you can ask
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {facts.starters.map((row) => (
            <li key={row.q}>
              <AskLink q={`${row.q} New Jersey`}>{row.q}</AskLink>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="more">
        <h2 id="more" className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
          More New Jersey research
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          <li>
            <Link href="/new-jersey" className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              New Jersey network gateway
            </Link>
          </li>
          {siblings.map((c) => (
            <li key={c.county_slug}>
              <Link
                href={njCountyAskPath(c.county_slug as NjPilotCountySlug)}
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: ASK_BRAND.indigo }}
              >
                {c.county} County
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
