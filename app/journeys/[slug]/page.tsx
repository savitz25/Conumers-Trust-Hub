import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LastReviewed } from '@/components/last-reviewed';
import { createPageMetadata } from '@/lib/seo/metadata';
import { getAllJourneySlugs, getJourneyBySlug } from '@/lib/growth/journeys';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllJourneySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const journey = getJourneyBySlug(slug);
  if (!journey) return {};
  return createPageMetadata({
    title: journey.metaTitle,
    description: journey.metaDescription,
    path: `/journeys/${journey.slug}`,
    type: 'article',
  });
}

export default async function JourneyPage({ params }: Props) {
  const { slug } = await params;
  const journey = getJourneyBySlug(slug);
  if (!journey) notFound();

  return (
    <article data-hub="ask" className="border-b" style={{ borderColor: ASK_BRAND.border }}>
      <header
        className="border-b"
        style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
      >
        <div className="container-page py-12 sm:py-14">
          <Breadcrumbs
            items={[
              { name: 'Home', path: '/' },
              { name: 'Life journeys', path: '/journeys' },
              { name: journey.title, path: `/journeys/${journey.slug}` },
            ]}
          />
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Life journey
          </p>
          <h1
            className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            {journey.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {journey.summary}
          </p>
          <p className="mt-3 text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>
            We cite. You decide. · {ASK_NETWORK_OWNERSHIP_SHORT}
          </p>
          <div className="mt-4">
            <LastReviewed date={journey.lastReviewed} />
          </div>
        </div>
      </header>

      <div className="container-page py-12 sm:py-14">
        <div className="max-w-3xl space-y-5 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          {journey.intro.map((p) => (
            <p key={p.slice(0, 48)}>{p}</p>
          ))}
        </div>

        <ol className="mt-12 space-y-8">
          {journey.steps.map((step) => (
            <li
              key={step.step}
              className="rounded-2xl border bg-white p-6 sm:p-8"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <p
                className="text-xs font-bold uppercase tracking-[0.14em]"
                style={{ color: ASK_BRAND.indigo }}
              >
                Step {step.step} · {step.hubLabel}
              </p>
              <h2
                className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
                style={{ color: ASK_BRAND.navy }}
              >
                {step.title}
              </h2>
              <p className="mt-2 text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                Why this step: {step.why}
              </p>
              <p className="mt-4 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {step.body}
              </p>
              {step.relatedGuides && step.relatedGuides.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
                  {step.relatedGuides.map((g) => (
                    <li key={g.href}>
                      <Link
                        href={g.href}
                        className="underline-offset-4 hover:underline"
                        style={{ color: ASK_BRAND.indigo }}
                      >
                        {g.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <a
                href={step.href}
                rel="noopener noreferrer"
                className="btn-primary mt-6 inline-flex min-h-11 w-full justify-center sm:w-auto"
              >
                {step.cta}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </li>
          ))}
        </ol>

        <section
          className="mt-12 max-w-3xl rounded-2xl border p-5 sm:p-6"
          style={{
            borderColor: ASK_BRAND.border,
            backgroundColor: ASK_BRAND.white,
            boxShadow: ASK_SHADOW.soft,
          }}
          aria-labelledby="limitations-heading"
        >
          <h2
            id="limitations-heading"
            className="text-lg font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            What this page does not do
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed sm:text-base" style={{ color: ASK_BRAND.ink }}>
            {journey.limitations.map((line) => (
              <li key={line} className="flex gap-2.5">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ASK_BRAND.indigo }}
                  aria-hidden
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <nav
          className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold"
          aria-label="Related"
        >
          <Link href="/journeys" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            All life journeys
          </Link>
          <Link href="/guides" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Educational guides
          </Link>
          <Link href="/methodology" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Ask Trust Hub Standard
          </Link>
          <Link href="/data-sources" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Data sources library
          </Link>
        </nav>
      </div>
    </article>
  );
}
