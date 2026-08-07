import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { LastReviewed } from '@/components/last-reviewed';
import { createPageMetadata } from '@/lib/seo/metadata';
import { getAllGuideSlugs, getGuideBySlug } from '@/lib/growth/guides';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { ASK_NETWORK_OWNERSHIP_SHORT } from '@/lib/network/standard-version';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};
  return createPageMetadata({
    title: guide.metaTitle,
    description: guide.metaDescription,
    path: `/guides/${guide.slug}`,
    type: 'article',
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

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
              { name: 'Guides', path: '/guides' },
              { name: guide.title, path: `/guides/${guide.slug}` },
            ]}
          />
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            {guide.vertical} · Educational guide
          </p>
          <h1
            className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: ASK_BRAND.navy }}
          >
            {guide.title}
          </h1>
          <p className="mt-3 text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>
            We cite. You decide. · {ASK_NETWORK_OWNERSHIP_SHORT}
          </p>
          <div className="mt-4">
            <LastReviewed date={guide.lastReviewed} />
          </div>
        </div>
      </header>

      <div className="container-page py-12 sm:py-14">
        <div
          className="max-w-3xl rounded-2xl border p-6 sm:p-8"
          style={{
            borderColor: ASK_BRAND.border,
            backgroundColor: ASK_BRAND.periwinkle,
            boxShadow: ASK_SHADOW.soft,
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-[0.12em]"
            style={{ color: ASK_BRAND.indigo }}
          >
            Definitive answer
          </p>
          <p className="mt-2 text-base font-medium leading-relaxed sm:text-lg" style={{ color: ASK_BRAND.navy }}>
            {guide.definitiveAnswer}
          </p>
        </div>

        <div className="mt-10 max-w-3xl space-y-10">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
                {section.heading}
              </h2>
              <div className="mt-3 space-y-4 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
              What this proves
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              {guide.proves.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
              What this does not prove
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              {guide.doesNotProve.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 max-w-3xl">
          <a
            href={guide.primarySource.url}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: ASK_BRAND.indigo }}
          >
            Primary source: {guide.primarySource.name}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>

        <div className="mt-8">
          <a
            href={guide.hubCta.href}
            rel="noopener noreferrer"
            className="btn-primary inline-flex min-h-11 w-full justify-center sm:w-auto"
          >
            {guide.hubCta.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </div>

        <nav className="mt-12 max-w-3xl border-t pt-8" style={{ borderColor: ASK_BRAND.border }}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: ASK_BRAND.indigo }}>
            Related
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            {guide.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.navy }}>
                  {r.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/methodology" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.navy }}>
                Ask Trust Hub Standard
              </Link>
            </li>
            <li>
              <Link href="/data-sources" className="underline-offset-4 hover:underline" style={{ color: ASK_BRAND.navy }}>
                Data sources library
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </article>
  );
}
