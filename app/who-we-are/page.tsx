import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { buildPersonSchema } from '@/lib/seo/schemas';
import { BRAND, FOUNDER } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Who We Are',
  description:
    'Accountability for Ask Trust Hub: founder identity, operating structure, and contact for corrections and methodology questions.',
  path: '/who-we-are',
});

export default function WhoWeArePage() {
  return (
    <>
      <JsonLd data={buildPersonSchema()} />
      <PageHeader
        label="Who we are"
        title="Operating accountability"
        description="Independent research claims require identifiable operators. The following records who is responsible for this network."
      />

      <div className="container-page py-14 sm:py-16">
        <article className="max-w-3xl border border-border/80 p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold tracking-wide text-navy"
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
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {FOUNDER.role} · {FOUNDER.location}
              </p>
              <p className="mt-5 text-[17px] leading-relaxed text-foreground/90">{FOUNDER.bio}</p>
            </div>
          </div>
        </article>

        <div className="prose-trust mt-12">
          <h2>Current operating structure</h2>
          <p>
            {BRAND.name} is currently a solo-founder operation. There is no separate newsroom entity
            and no anonymous research committee. Network policy, independence standards, and
            commercial decisions rest with the founder until governance is expanded and disclosed
            here.
          </p>
          <p>
            Specialist hubs may attribute specific research programs to editors or analysts as those
            roles are established. Attribution will be named and public when used.
          </p>

          <h2>Correspondence</h2>
          <p>
            For corrections, methodology questions, press, and partnership inquiries, contact{' '}
            <a className="link-inline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
            . Response target: two business days.
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
