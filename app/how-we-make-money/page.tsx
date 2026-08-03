import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { REVENUE_MODEL } from '@/lib/content';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'How We Make Money',
  description:
    'Transparent revenue model for Ask Trust Hub: what funds the network today, intended future revenue, and what we will never sell.',
  path: '/how-we-make-money',
});

export default function HowWeMakeMoneyPage() {
  return (
    <>
      <PageHeader
        label="How we make money"
        title="Transparent revenue. No hidden ranking market."
        description="If a research network will not explain how it gets paid, assume the ranking is the product being sold."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            {BRAND.name} publishes this page because independence claims are empty without revenue
            honesty. Below is the current model, the intended model, and the hard “never” list.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <section className="card-surface p-6">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Current</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {REVENUE_MODEL.current.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-surface p-6">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Intended</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {REVENUE_MODEL.intended.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-surface border-trust/20 p-6">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Never</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {REVENUE_MODEL.never.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="prose-trust mt-14">
          <h2>Why this matters</h2>
          <p>
            Many “comparison” sites monetize by auctioning attention. That incentive quietly rewrites
            what consumers see first. Our constraint is structural: commercial options must not buy
            trust ordering. If that ever changes, this page will change first.
          </p>
          <p className="mt-8 flex flex-wrap gap-4 not-prose">
            <Link href="/promise" className="btn-primary">
              Independence promise
            </Link>
            <Link href="/contact" className="btn-secondary">
              Ask a revenue question
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
