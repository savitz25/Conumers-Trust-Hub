import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { TRUST_SCORE_PHILOSOPHY, VERIFICATION_STEPS } from '@/lib/content';

export const metadata = createPageMetadata({
  title: 'How We Verify / Methodology',
  description:
    'ConsumerTrust Hub verification process and Trust Score philosophy: primary public sources, explainable factors, and zero paid influence on rankings.',
  path: '/methodology',
});

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        label="How we verify"
        title="Methodology & Trust Score philosophy"
        description="How the network verifies providers, what a Trust Score is (and is not), and how we stay explainable."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            Verification is the core product of the ConsumerTrust Hub network. Specialist hubs
            implement market-specific checks; this page defines the shared philosophy so consumers
            know what “verified” means—and what it does not.
          </p>
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Verification process
          </h2>
          <ol className="mt-8 space-y-4">
            {VERIFICATION_STEPS.map((step) => (
              <li key={step.step} className="card-surface flex gap-5 p-6">
                <span className="text-sm font-semibold tabular-nums text-trust">{step.step}</span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Trust Score philosophy
          </h2>
          <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-muted-foreground">
            Where specialist hubs display a Trust Score or composite signal, it is an editorial
            research aid grounded in public data—not a credit score, endorsement, or guarantee.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {TRUST_SCORE_PHILOSOPHY.map((item) => (
              <article key={item.title} className="card-surface p-6">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="prose-trust mt-16">
          <h2>Important limits</h2>
          <p>
            Public records can lag reality. Licenses get suspended, companies rebrand, and complaint
            data is incomplete. Always re-check FMCSA, state DOI / NAIC pathways, NMLS Consumer
            Access, and the provider’s own documentation before you sign.
          </p>
          <p className="mt-8 flex flex-wrap gap-4 not-prose">
            <Link href="/data-sources" className="btn-primary">
              Data sources
            </Link>
            <Link href="/editorial-standards" className="btn-secondary">
              Editorial standards
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
