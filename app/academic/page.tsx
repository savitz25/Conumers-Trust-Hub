import Link from 'next/link';
import { ArrowUpRight, Mail } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { TrustMark } from '@/components/trust-mark';
import {
  ACADEMIC_CITATION_NOTES,
  ACADEMIC_CITATION_TEMPLATE,
  ACADEMIC_DATASETS,
  ACADEMIC_DEFERRED_OUTREACH,
  ACADEMIC_DOI_CANDIDATE_REPOSITORIES,
  ACADEMIC_ENGAGEMENT_TIERS,
  ACADEMIC_EXPANSION_TRACKS,
  ACADEMIC_INDEPENDENCE_CHARTER,
  ACADEMIC_PREFERRED_AUDIENCES,
  ACADEMIC_PRIMARY_TRACKS,
  ACADEMIC_PROGRAM_NAME,
  ACADEMIC_PROGRAM_STATUS_BADGE,
  ACADEMIC_PROJECTS,
  ACADEMIC_SUCCESS_METRICS,
  ENTITY_RESOLUTION_BENCHMARK_STATUS,
  ENTITY_RESOLUTION_BENCHMARK_TITLE,
  ENTITY_RESOLUTION_EXAMPLE_CLASSES,
  ENTITY_RESOLUTION_FUTURE_METRICS,
  academicReleaseLabel,
} from '@/lib/academic';
import { BRAND } from '@/lib/brand';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { TRUST_HUBS } from '@/lib/hubs';
import { ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { buildWebPageSchema } from '@/lib/seo/schemas';
import { TRUST_PAGE_REVIEWED } from '@/lib/trust-reviewed';

export const metadata = createPageMetadata({
  title: 'Academic Research Program',
  description:
    'Independent academic research using public regulatory, business identity, enforcement, and consumer-protection data from the TrustHub network.',
  path: '/academic',
});

const VERTICAL_LABEL: Record<string, string> = {
  move: 'Move Trust Hub',
  lender: 'Lender Trust Hub',
  insurance: 'Insurance Trust Hub',
  contractor: 'Contractor Trust Hub',
  senior: 'SeniorTrustHub',
  investor: 'InvestorTrustHub',
  'cross-network': 'Cross-network',
};

export default function AcademicPage() {
  return (
    <>
      <JsonLd
        data={buildWebPageSchema({
          name: 'Academic Research Program | Ask Trust Hub',
          description:
            'Independent academic research using public regulatory, business identity, enforcement, and consumer-protection data from the TrustHub network.',
          path: '/academic',
        })}
      />

      <PageHeader
        label={ACADEMIC_PROGRAM_NAME}
        title="Independent research using public regulatory and consumer-protection data"
        description="The TrustHub network organizes difficult public regulatory datasets across multiple consumer industries. This page is the professional foundation for selected research datasets, documentation, benchmarks, and project opportunities — not a claim that universities already use TrustHub."
      />

      <div className="container-page overflow-x-hidden py-14 sm:py-16">
        <Breadcrumbs
          items={[
            { name: 'Home', path: '/' },
            { name: 'Academic research', path: '/academic' },
          ]}
        />

        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TrustMark />
          <LastReviewed date={TRUST_PAGE_REVIEWED.academic} />
        </div>

        <p
          className="mb-12 inline-flex max-w-full flex-wrap items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide"
          style={{
            borderColor: ASK_BRAND.border,
            backgroundColor: ASK_BRAND.periwinkle,
            color: ASK_BRAND.indigo,
          }}
        >
          {ACADEMIC_PROGRAM_STATUS_BADGE}
        </p>

        {/* Why the data exists */}
        <section className="mb-16 max-w-3xl" aria-labelledby="why-data-heading">
          <h2
            id="why-data-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Why TrustHub data exists
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Specialist TrustHub sites assemble structured public-source evidence so consumers — and,
            later, independent researchers — can inspect identity, licensing, and enforcement
            context without buying a ranking. {ASK_NETWORK_OWNERSHIP_SHORT}. Evidence models differ
            by industry. Identical coverage across hubs is not claimed.
          </p>
          <p className="mt-3 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Ask Trust Hub is the parent research and standards layer. Directories and deep tools
            stay on specialist domains.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {TRUST_HUBS.map((hub) => (
              <li
                key={hub.id}
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <a
                  href={hub.url}
                  className="font-semibold underline-offset-4 hover:underline"
                  style={{ color: ASK_BRAND.navy }}
                  rel="noopener noreferrer"
                >
                  {hub.name}
                  <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" aria-hidden />
                </a>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {hub.verification}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            <Link href="/network" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              Network
            </Link>
            <Link href="/methodology" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              Methodology
            </Link>
            <Link href="/data-sources" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              Data sources
            </Link>
            <Link href="/promise" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              Independence
            </Link>
            <Link href="/trust" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
              Trust Center
            </Link>
          </p>
        </section>

        {/* Charter */}
        <section className="mb-16" aria-labelledby="charter-heading">
          <h2
            id="charter-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Academic independence charter
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            These are program principles. They apply whether or not a university ever uses the
            materials.
          </p>
          <ol className="mt-8 space-y-4">
            {ACADEMIC_INDEPENDENCE_CHARTER.map((item, i) => (
              <li
                key={item.id}
                className="rounded-2xl border bg-white p-5 sm:p-6"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <p className="text-xs font-semibold tabular-nums" style={{ color: ASK_BRAND.indigo }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed sm:text-base" style={{ color: ASK_BRAND.ink }}>
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Year-one tracks */}
        <section className="mb-16" aria-labelledby="tracks-heading">
          <h2
            id="tracks-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Year-one research focus
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            The initial program stays narrow. Two primary tracks only. Other disciplines are listed
            as possible later expansion — not as open offerings.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ACADEMIC_PRIMARY_TRACKS.map((track) => (
              <div
                key={track.id}
                className="rounded-2xl border bg-white p-6"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
                  Primary track
                </p>
                <h3 className="mt-2 text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {track.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {track.summary}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Future expansion areas:{' '}
            {ACADEMIC_EXPANSION_TRACKS.map((t) => t.name).join(', ')}. Not launched.
          </p>
        </section>

        {/* Engagement */}
        <section className="mb-16" aria-labelledby="engagement-heading">
          <h2
            id="engagement-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Engagement model
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {ACADEMIC_ENGAGEMENT_TIERS.map((tier) => {
              const closed = tier.availability === 'not-currently-open';
              return (
                <div
                  key={tier.tier}
                  className="rounded-2xl border p-6"
                  style={{
                    borderColor: ASK_BRAND.border,
                    backgroundColor: closed ? ASK_BRAND.canvas : ASK_BRAND.white,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
                      Tier {tier.tier}
                    </p>
                    {closed ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.ink }}
                      >
                        Future · not currently open
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: ASK_BRAND.periwinkle, color: ASK_BRAND.indigo }}
                      >
                        Planned
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                    {tier.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                    {tier.summary}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
            TrustHub is not promising funding and is not soliciting funded proposals.
          </p>
        </section>

        {/* Dataset catalog */}
        <section id="datasets" className="mb-16 scroll-mt-24" aria-labelledby="datasets-heading">
          <h2
            id="datasets-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Research dataset registry (preview)
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            No academic datasets are published yet. Entries below are prospective research areas
            aligned to evidence each specialist hub already uses. There are no download links and no
            DOIs.
          </p>
          <ul className="mt-8 space-y-4">
            {ACADEMIC_DATASETS.map((ds) => (
              <li
                key={ds.id}
                className="rounded-2xl border bg-white p-5 sm:p-6"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
                    {VERTICAL_LABEL[ds.vertical] ?? ds.vertical}
                  </span>
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.ink }}
                  >
                    {academicReleaseLabel(ds.releaseStatus)}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
                  {ds.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  {ds.description}
                </p>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  Sources: {ds.sourceAuthorities.join(' · ')} · Access:{' '}
                  {ds.accessLevel.replaceAll('_', ' ').toLowerCase()} · DOI: none assigned · Download:
                  not available
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Versioning + citation */}
        <section className="mb-16 grid gap-8 lg:grid-cols-2" aria-labelledby="versioning-heading">
          <div>
            <h2
              id="versioning-heading"
              className="text-2xl font-semibold tracking-tight"
              style={{ color: ASK_BRAND.navy }}
            >
              Versioned, longitudinal data
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Future academic releases should be immutable, date-stamped, reproducible,
              source-attributed, documented, and retained historically rather than overwritten.
              Public registries often replace prior state; a snapshot can become more useful with
              time for that reason.
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              This page states the contract. It does not run a production snapshot pipeline.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
              Citation and DOI readiness
            </h2>
            <p className="mt-4 font-mono text-sm leading-relaxed" style={{ color: ASK_BRAND.navy }}>
              {ACADEMIC_CITATION_TEMPLATE}
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              {ACADEMIC_CITATION_NOTES.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm" style={{ color: ASK_BRAND.ink }}>
              Possible later archives (not registered):{' '}
              {ACADEMIC_DOI_CANDIDATE_REPOSITORIES.map((r) => r.name).join(', ')}.
            </p>
          </div>
        </section>

        {/* ER benchmark */}
        <section className="mb-16" aria-labelledby="benchmark-heading">
          <h2
            id="benchmark-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            {ENTITY_RESOLUTION_BENCHMARK_TITLE}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {ENTITY_RESOLUTION_BENCHMARK_STATUS}
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: ASK_BRAND.border }}>
              <h3 className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                Future example classes
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm" style={{ color: ASK_BRAND.ink }}>
                {ENTITY_RESOLUTION_EXAMPLE_CLASSES.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-white p-5" style={{ borderColor: ASK_BRAND.border }}>
              <h3 className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                Future metrics (not computed)
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm" style={{ color: ASK_BRAND.ink }}>
                {ENTITY_RESOLUTION_FUTURE_METRICS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Projects */}
        <section className="mb-16" aria-labelledby="projects-heading">
          <h2
            id="projects-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Turnkey project library
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {ACADEMIC_PROJECTS.length} research questions for a future classroom or capstone library.
            They are not assignments currently in the field. Projects involving human participants
            are marked for likely IRB review.
          </p>
          <div className="mt-8 space-y-6">
            {ACADEMIC_PROJECTS.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border bg-white p-5 sm:p-6"
                style={{ borderColor: ASK_BRAND.border }}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
                    {p.academicTrack === 'data-science-ai' ? 'Data science / AI' : 'Public policy'}
                  </span>
                  <span className="text-xs" style={{ color: ASK_BRAND.ink }}>
                    {p.recommendedLevel.replace('-', ' ')} · {p.expectedDifficulty}
                    {p.irbLikely ? ' · IRB likely' : ''}
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  <span className="font-semibold">Question. </span>
                  {p.researchQuestion}
                </p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  <span className="font-semibold">Why it matters. </span>
                  {p.whyItMatters}
                </p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  <span className="font-semibold">Verticals. </span>
                  {p.verticals.map((v) => VERTICAL_LABEL[v] ?? v).join(', ')}
                </p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                  <span className="font-semibold">Potential output. </span>
                  {p.potentialOutput}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Audiences + metrics */}
        <section className="mb-16 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
              Preferred audiences (later)
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Outreach is not part of this foundation. When it begins, it should not start as
              cold-emailing individual professors.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
              {ACADEMIC_PREFERRED_AUDIENCES.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
            <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
              Deferred: {ACADEMIC_DEFERRED_OUTREACH.join('; ')}.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
              How we will judge success
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Raw partnership count is not the primary metric.
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              {ACADEMIC_SUCCESS_METRICS.map((m) => (
                <li key={m.id}>
                  <span className="font-semibold">{m.label}. </span>
                  {m.why}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Contact */}
        <section
          className="rounded-2xl border p-6 sm:p-8"
          style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
          aria-labelledby="contact-heading"
        >
          <h2 id="contact-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
            Discuss an academic research project
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Use the existing Ask Trust Hub contact path. Include “academic research” in the subject.
            There is no researcher portal, mailing list, or student-data form on this page.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: ASK_BRAND.indigo }}
            >
              Open contact
            </Link>
            <a
              href={`mailto:${BRAND.email}?subject=${encodeURIComponent('Academic research project')}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold"
              style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
            >
              <Mail className="h-4 w-4" aria-hidden />
              {BRAND.email}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
