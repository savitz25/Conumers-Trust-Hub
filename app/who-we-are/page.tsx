import Link from 'next/link';
import { LastReviewed } from '@/components/last-reviewed';
import { PageHeader } from '@/components/page-header';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { buildPersonSchema } from '@/lib/seo/schemas';
import { BRAND, FOUNDER } from '@/lib/brand';
import {
  ASK_NETWORK_OWNERSHIP_LINE,
  ASK_NETWORK_OWNERSHIP_SHORT,
} from '@/lib/network/standard-version';
import { TRUST_PAGE_REVIEWED } from '@/lib/trust-reviewed';
import { ASK_BRAND } from '@/lib/design/ask-design-system';

export const metadata = createPageMetadata({
  title: 'Who We Are — Organizational Accountability',
  description:
    'Who operates Ask Trust Hub: founder accountability, common ownership across the Ask Trust Hub network, revenue honesty, corrections, and contact.',
  path: '/who-we-are',
});

const ACCOUNTABILITY = [
  {
    q: 'Who operates Ask Trust Hub?',
    a: `${BRAND.name} is currently a solo-founder operation led by ${FOUNDER.name} (${FOUNDER.role}). There is no separate anonymous research committee. Network policy and commercial decisions rest with the founder until governance is expanded and disclosed here.`,
  },
  {
    q: 'What is the ownership relationship across the four domains?',
    a: `${ASK_NETWORK_OWNERSHIP_LINE} Ask is the parent knowledge and standards layer. The specialist hubs are research products under that network — not unrelated companies.`,
  },
  {
    q: 'How does the network make money?',
    a: 'Core research pages and directories are free for consumers. We do not sell paid placements or sponsored rankings that alter trust ordering. Intended future revenue (if any) is disclosed on How We Make Money and must stay isolated from organic research order.',
  },
  {
    q: 'Can ranking or placement be purchased?',
    a: 'No. Ranking order, Trust Scores, and verification badges are not commercial products for sale. See the Independence Policy.',
  },
  {
    q: 'How are corrections handled?',
    a: 'Material factual errors are reviewed against primary public sources. Commercial interest does not change outcomes. Use the Corrections page with URL, claim, and primary source.',
  },
  {
    q: 'How do I contact the organization?',
    a: `Email ${BRAND.email}. Response target: two business days. Press, corrections, methodology, and partnership inquiries use the same address unless a dedicated channel is later published here.`,
  },
] as const;

export default function WhoWeArePage() {
  return (
    <>
      <JsonLd data={buildPersonSchema()} />
      <PageHeader
        label="Who we are"
        title="Organizational accountability"
        description="Independent research claims require identifiable operators. This page answers who runs the network, how ownership works, how money works, and how to get a correction."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="mb-8">
          <LastReviewed date={TRUST_PAGE_REVIEWED.whoWeAre} />
        </div>

        <article
          className="max-w-3xl rounded-2xl border p-8 sm:p-10"
          style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tracking-wide"
              style={{
                borderColor: ASK_BRAND.border,
                backgroundColor: ASK_BRAND.periwinkle,
                color: ASK_BRAND.navy,
              }}
              aria-hidden
            >
              {FOUNDER.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <h2
                id="founder"
                className="text-2xl font-semibold tracking-tight"
                style={{ color: ASK_BRAND.navy }}
              >
                {FOUNDER.name}
              </h2>
              <p className="mt-1 text-sm font-medium" style={{ color: ASK_BRAND.ink }}>
                {FOUNDER.role} · {FOUNDER.location}
              </p>
              <p className="mt-5 text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {FOUNDER.bio}
              </p>
              <p className="mt-4 text-sm font-medium" style={{ color: ASK_BRAND.indigo }}>
                {ASK_NETWORK_OWNERSHIP_SHORT}
              </p>
            </div>
          </div>
        </article>

        <section className="mt-14" aria-labelledby="accountability-heading">
          <h2
            id="accountability-heading"
            className="text-2xl font-semibold tracking-tight"
            style={{ color: ASK_BRAND.navy }}
          >
            Clear answers
          </h2>
          <dl className="mt-8 space-y-8">
            {ACCOUNTABILITY.map((item) => (
              <div key={item.q} className="max-w-3xl border-b pb-8 last:border-0" style={{ borderColor: ASK_BRAND.border }}>
                <dt className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {item.q}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed sm:text-base" style={{ color: ASK_BRAND.ink }}>
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="prose-trust mt-14 max-w-3xl">
          <h2>Legal entity details</h2>
          <p>
            Public display name: <strong>{BRAND.name}</strong>. Schema <code>legalName</code>{' '}
            currently uses the same public brand string. Formal registered entity name, mailing
            address, and formation jurisdiction will be published here when finalized — we do not
            invent them.
          </p>
          <p>
            Domains in the network: asktrusthub.com (parent), movetrusthub.com, lendertrusthub.com,
            insurancetrusthub.com, contractortrusthub.com, seniortrusthub.com, investortrusthub.com.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/contact" className="btn-primary">
            Contact
          </Link>
          <Link href="/how-we-make-money" className="btn-secondary">
            How we make money
          </Link>
          <Link href="/promise" className="btn-secondary">
            Independence policy
          </Link>
          <Link href="/corrections" className="btn-secondary">
            Corrections
          </Link>
          <Link href="/about" className="btn-secondary">
            About the network
          </Link>
        </div>
      </div>
    </>
  );
}
