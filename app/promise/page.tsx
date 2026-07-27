import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { INDEPENDENCE_PLEDGES } from '@/lib/content';
import { BRAND } from '@/lib/brand';

export const metadata = createPageMetadata({
  title: 'Independence Policy — Zero Paid Placements',
  description:
    'ConsumerTrust Hub independence policy: zero paid placements, transparent methodology, and separation of research from commerce.',
  path: '/promise',
});

export default function PromisePage() {
  return (
    <>
      <PageHeader
        label="Independence policy"
        title="Editorial ranking is not a commercial product"
        description="Zero paid placements. Published methodology. Structural separation between research signals and revenue."
      />

      <div className="container-page py-14 sm:py-16">
        <div className="prose-trust">
          <p>
            {BRAND.name} rejects sponsored “top” lists that present as independent research. Across
            the parent site and every Trust Hub, editorial trust signals—ranking order, Trust Scores,
            and verification badges—cannot be purchased.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {INDEPENDENCE_PLEDGES.map((item) => (
            <article key={item.title} className="border border-border/80 p-6">
              <h2 className="text-base font-semibold tracking-tight text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>

        <section className="prose-trust mt-16">
          <h2>What “no paid placements” means</h2>
          <ul>
            <li>Providers cannot buy higher rank, featured badges, or preferred sort order.</li>
            <li>Trust Scores and verification badges are not commercial products for sale.</li>
            <li>
              Any future advertising or opt-in commercial tools will be labeled and isolated from
              organic research ordering.
            </li>
            <li>
              Corrections are evaluated against public records and evidence, not commercial interest.
            </li>
          </ul>

          <h2>What the network is not</h2>
          <p>
            The network is not a moving company, mortgage broker, bank, insurance agency, or lead
            marketplace. Specialist hubs may offer optional consumer tools; those tools do not alter
            independence rules.
          </p>

          <h2>Enforcement</h2>
          <p>
            Network policy is published on this parent site and applied by each Trust Hub. Reports of
            sold placement or ranking are treated as integrity issues. Contact{' '}
            <a className="link-inline" href={`mailto:${BRAND.email}`}>
              {BRAND.email}
            </a>
            .
          </p>

          <p className="mt-10 flex flex-wrap gap-3 not-prose">
            <Link href="/methodology" className="btn-primary">
              Methodology
            </Link>
            <Link href="/how-we-make-money" className="btn-secondary">
              Revenue disclosure
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
