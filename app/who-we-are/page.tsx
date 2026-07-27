import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { buildPersonSchema } from '@/lib/seo/schemas';
import { BRAND, FOUNDER } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Who We Are',
  description:
    'Meet the founder behind ConsumerTrust Hub: a solo-operated independent consumer research network for moving, insurance, and lending.',
  path: '/who-we-are',
});

export default function WhoWeArePage() {
  return (
    <>
      <JsonLd data={buildPersonSchema()} />
      <PageHeader
        label="Who we are"
        title="Named people. Clear accountability."
        description="Trust networks should not hide behind anonymous brands. Here is who operates ConsumerTrust Hub today."
      />

      <div className="container-page py-14 sm:py-16">
        <article className="card-surface max-w-3xl p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy text-lg font-semibold text-white"
              aria-hidden
            >
              {FOUNDER.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <h2 id="founder" className="text-2xl font-semibold tracking-tight text-foreground">
                {FOUNDER.name}
              </h2>
              <p className="mt-1 text-sm font-medium text-trust">{FOUNDER.role}</p>
              <p className="mt-1 text-sm text-muted-foreground">{FOUNDER.location}</p>
              <p className="mt-5 text-[17px] leading-relaxed text-foreground/90">{FOUNDER.bio}</p>
            </div>
          </div>
        </article>

        <div className="prose-trust mt-12">
          <h2>Solo founder, on purpose (for now)</h2>
          <p>
            {BRAND.name} is currently a solo-founder project. That is not a temporary secret—it is
            the honest state of the network. There is no large newsroom façade and no invented
            “research committee” standing in for one operator.
          </p>
          <p>
            Specialist hubs may credit editors and analysts for specific research programs as those
            teams grow. Network-level standards, independence policy, and commercial decisions sit
            with the founder until governance expands publicly.
          </p>
          <h2>How to reach a human</h2>
          <p>
            Corrections, methodology questions, press, and partnership inquiries go to{' '}
            <a className="link-inline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
            . We aim to respond within two business days.
          </p>
          <p className="mt-8 not-prose">
            <Link href="/contact" className="btn-primary">
              Contact
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
