import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { EDITORIAL_STANDARDS } from '@/lib/content';

export const metadata = createPageMetadata({
  title: 'Editorial Standards',
  description:
    'ConsumerTrust Hub editorial standards: quality rules, corrections policy, and how AI may be used without fabricating credentials or reviews.',
  path: '/editorial-standards',
});

export default function EditorialStandardsPage() {
  return (
    <>
      <PageHeader
        label="Editorial standards"
        title="Quality, corrections, and AI use"
        description="How the network writes, fixes mistakes, and uses modern tools without compromising verification."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card-surface p-6 lg:col-span-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Quality standards</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {EDITORIAL_STANDARDS.quality.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-surface p-6 lg:col-span-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Corrections policy</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {EDITORIAL_STANDARDS.corrections.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-surface p-6 lg:col-span-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">AI use</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {EDITORIAL_STANDARDS.aiUse.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="prose-trust mt-14">
          <h2>Scope note</h2>
          <p>
            The parent site stays lean by design. Long-form guides and market directories belong on
            specialist Trust Hubs, under these same standards. If a page on any hub conflicts with
            this policy, network standards win—and the page should be corrected.
          </p>
          <p className="mt-8 flex flex-wrap gap-4 not-prose">
            <Link href="/methodology" className="btn-primary">
              Methodology
            </Link>
            <Link href="/contact" className="btn-secondary">
              Request a correction
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
