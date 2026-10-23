import Link from 'next/link';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/page-header';
import { SampleRequestForm } from '@/components/research-services/sample-request-form';
import { BRAND } from '@/lib/brand';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { ASK_NETWORK_OWNERSHIP_LINE } from '@/lib/network/standard-version';
import { RESEARCH_SERVICES_INQUIRY } from '@/lib/research-services/inquiry';
import { JsonLd } from '@/lib/seo/json-ld';
import { createPageMetadata } from '@/lib/seo/metadata';
import { buildWebPageSchema } from '@/lib/seo/schemas';

export const metadata = createPageMetadata({
  title: 'Trust Hub Research Services',
  description:
    'Source-dated vendor research for Florida HOA, condominium, and property-management teams reviewing contractor identities, license records, disciplinary history, and follow-up items.',
  path: '/research-services',
});

const REVIEW_ITEMS = [
  {
    title: 'Business identity and available license identifiers',
    body: 'The names and license numbers that can be checked against a public source.',
  },
  {
    title: 'License status and expiration dates',
    body: 'The status and dates shown by the source on the day of the check.',
  },
  {
    title: 'Relevant public disciplinary and enforcement records',
    body: 'Public actions that match the confirmed identity and matter to the vendor review.',
  },
  {
    title: 'Available workers’ compensation evidence, where reliably verifiable',
    body: 'Evidence included only when a source can be checked. Coverage is not assumed.',
  },
  {
    title: 'Missing information and documents your team should request',
    body: 'A list of gaps, including documents the association or manager should ask the vendor to provide.',
  },
];

const STEPS = [
  'Tell us about your vendor list.',
  'We confirm scope and identifying information.',
  'We compile and manually review the research.',
  'You receive the report and follow-up items.',
];

const FAQ = [
  {
    q: 'Who is this service for?',
    a: 'Florida HOA, condominium association, and property-management teams that are reviewing contractor vendors. It is a factual research aid for that review.',
  },
  {
    q: 'What information is needed to identify a vendor?',
    a: 'The business name used on the license or contract, any license number you already have, and the Florida city or county where the work is performed. This first request does not collect vendor documents.',
  },
  {
    q: 'What happens when an identity cannot be confirmed?',
    a: 'The finding says the identity could not be confirmed and lists the details still needed. The report does not substitute a guessed match.',
  },
  {
    q: 'Is insurance fully verified?',
    a: 'Workers’ compensation evidence is included only where a source can be checked. The report does not confirm a complete insurance program, policy limits, or additional-insured status.',
  },
  {
    q: 'Does the report recommend hiring a vendor?',
    a: 'No. The report separates verified findings, items needing review, and unverified information. It is factual research. It is not a compliance certification, and it is not a judgment that a vendor is suitable.',
  },
];

export default function ResearchServicesPage() {
  return (
    <>
      <JsonLd
        data={buildWebPageSchema({
          name: 'Trust Hub Research Services | Ask Trust Hub',
          description:
            'Source-dated vendor research for Florida property-management and association teams.',
          path: '/research-services',
        })}
      />
      <PageHeader
        label="Trust Hub Research Services"
        title="Know more about the contractors working on your properties."
        description="Source-dated vendor research that helps property managers and association boards review contractor identities, license records, relevant disciplinary history and information requiring follow-up."
      />

      <div className="container-page py-10 sm:py-14">
        <Breadcrumbs
          items={[
            { name: 'Home', path: '/' },
            { name: 'Research Services', path: '/research-services' },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <a href="#sample-request" className="btn-primary w-full sm:w-auto">Request a complimentary sample</a>
          <a href="#what-we-review" className="btn-secondary w-full sm:w-auto">See what we review</a>
        </div>

        <section id="what-we-review" aria-labelledby="what-we-review-heading" className="mt-14 scroll-mt-24">
          <h2 id="what-we-review-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
            What we review
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Available records and coverage vary by vendor and source. A check reports what the source showed on that date.
          </p>
          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {REVIEW_ITEMS.map((item) => (
              <li key={item.title} className="card-surface p-5">
                <h3 className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="what-you-receive-heading" className="mt-14 scroll-mt-24">
          <h2 id="what-you-receive-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
            What you receive
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            A concise vendor-list summary, individual findings, original source links, check dates, and specific follow-up items.
          </p>
          <dl className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="card-surface p-5">
              <dt className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>Verified findings</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">Facts tied to a confirmed identity and a cited source, with the check date.</dd>
            </div>
            <div className="card-surface p-5">
              <dt className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>Items needing review</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">Records that match part of the identity, or gaps your team should resolve before relying on them.</dd>
            </div>
            <div className="card-surface p-5">
              <dt className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>Unverified information</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">Details supplied by the vendor or found without a reliable source match. These stay labeled as unverified.</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="how-it-works-heading" className="mt-14 scroll-mt-24">
          <h2 id="how-it-works-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step} className="card-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
                  Step {index + 1}
                </p>
                <p className="mt-3 text-base font-semibold leading-relaxed" style={{ color: ASK_BRAND.navy }}>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="pilot-heading" className="mt-14 scroll-mt-24">
          <div className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.periwinkle }}>
            <h2 id="pilot-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
              Florida vendor-review pilot
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              We are accepting inquiries for an initial Florida vendor-review pilot. Request a complimentary sample and a quote for your vendor list.
            </p>
            <a href="#sample-request" className="btn-primary mt-6 w-full sm:w-auto">Request a complimentary sample</a>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="mt-14 scroll-mt-24">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
            Questions
          </h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="card-surface p-5">
                <summary className="cursor-pointer text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]" style={{ color: ASK_BRAND.navy }}>
                  {item.q}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed sm:text-base" style={{ color: ASK_BRAND.ink }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="sample-request" aria-labelledby="sample-request-heading" className="mt-14 scroll-mt-24">
          <p className="mb-4 max-w-3xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {RESEARCH_SERVICES_INQUIRY.reason} There is no inquiry submission endpoint on this page.
          </p>
          <SampleRequestForm />
          <noscript>
            <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
              Email {BRAND.email} with your name, work email, organization, role, and approximate vendor count.
            </p>
          </noscript>
        </section>

        <section aria-labelledby="independence-heading" className="mt-14 scroll-mt-24">
          <h2 id="independence-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
            Independence
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            Paid research services do not influence Trust Hub’s public rankings or independent findings.
          </p>
          <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {ASK_NETWORK_OWNERSHIP_LINE}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Public display name: {BRAND.name}. The formal registered entity name, mailing address, and formation jurisdiction are published on Who we are when they are finalized.
          </p>
          <ul className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
            <li><Link className="link-inline" href="/who-we-are">Who we are</Link></li>
            <li><Link className="link-inline" href="/promise">Independence policy</Link></li>
            <li><Link className="link-inline" href="/how-we-make-money">How we make money</Link></li>
            <li><Link className="link-inline" href="/privacy">Privacy policy</Link></li>
            <li><Link className="link-inline" href="/terms">Terms of service</Link></li>
          </ul>
        </section>
      </div>
    </>
  );
}
